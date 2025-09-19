import { createModuleLogger } from '../utils/logger.js';
import { aiMemoryManager } from '../database/aiMemoryManager.js';
import { mcpTools } from './mcpTools.js';

const logger = createModuleLogger('AITools');

export class AITools {
  constructor() {
    this.toolExecutionQueue = new Map();
  }

  /**
   * Process AI tool decisions from conversation
   */
  async processAIToolDecisions(userId, toolDecisions, geminiClient) {
    if (this.toolExecutionQueue.has(userId)) {
      logger.debug(`Tool execution already in progress for ${userId}`);
      return null;
    }

    this.toolExecutionQueue.set(userId, true);

    try {
      if (!toolDecisions || !toolDecisions.tool_operations) {
        return null;
      }

      const operations = toolDecisions.tool_operations;
      logger.info(`Processing ${operations.length} tool operations for ${userId}`);

      let results = [];
      for (const operation of operations) {
        const result = await this.executeToolOperation(userId, operation);
        if (result) results.push(result);
      }

      return results.length > 0 ? results : null;
    } catch (error) {
      logger.error('Error processing AI tool decisions:', error);
      return null;
    } finally {
      this.toolExecutionQueue.delete(userId);
    }
  }

  /**
   * Execute individual tool operation
   */
  async executeToolOperation(userId, operation) {
    try {
      const { tool, parameters, reason } = operation;

      if (!tool) {
        logger.warn('Invalid tool operation format:', operation);
        return null;
      }

      logger.debug(`Executing tool ${tool} for ${userId}: ${reason}`);

      // Execute the tool using MCP tools
      const result = await mcpTools.executeTool(tool, { userId, ...(parameters || {}) });
      
      logger.success(`Tool ${tool} executed successfully`);
      return {
        tool,
        result,
        reason
      };
    } catch (error) {
      logger.error('Error executing tool operation:', error);
      return {
        tool: operation.tool,
        error: error.message,
        reason: operation.reason
      };
    }
  }

  /**
   * Generate tool analysis prompt for AI
   */
  generateToolAnalysisPrompt(userMessage, availableTools) {
    const toolsList = Object.entries(availableTools).map(([name, info]) => 
      `- ${name}: ${info.description}`
    ).join('\n');

    return `TOOL ANALYSIS TASK:

Analyze the user's message and determine if any tools should be executed.

USER MESSAGE: "${userMessage}"

AVAILABLE TOOLS:
${toolsList}

RESPOND WITH JSON ONLY:
{
  "tool_operations": [
    {
      "tool": "tool_name",
      "parameters": {...},
      "reason": "why this tool should be executed"
    }
  ]
}

TOOL EXECUTION RULES:
1. Only suggest tools that are clearly needed based on the user's message
2. Don't execute tools for information that can be answered without them
3. For time/date queries, use appropriate time/date tools
4. For calculations, use calculate tool
5. For messaging requests, use send_message_to_number with number and message parameters
6. If no tools are needed, return empty array: []
7. When user asks to send a message to a number, extract the number and message content
8. For emotional context or memory storage, include relevant data in parameters

RESPOND WITH VALID JSON ONLY - NO OTHER TEXT.`;
  }

  /**
   * Ask AI to analyze message for tool operations
   */
  async analyzeMessageForToolOperations(userId, userMessage, availableTools, geminiClient) {
    try {
      const analysisPrompt = this.generateToolAnalysisPrompt(userMessage, availableTools);

      // Create a simple conversation for analysis
      const analysisHistory = [
        {
          role: 'user',
          parts: [{ text: analysisPrompt }]
        }
      ];

      const response = await geminiClient.generateContent(analysisHistory, null, null, 1);
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const toolDecisions = JSON.parse(jsonMatch[0]);
        
        if (toolDecisions.tool_operations && toolDecisions.tool_operations.length > 0) {
          logger.info(`AI identified ${toolDecisions.tool_operations.length} tool operations`);
          return await this.processAIToolDecisions(userId, toolDecisions, geminiClient);
        }
        
        return null;
      } else {
        logger.debug('No valid JSON found in AI tool analysis response');
        return null;
      }
    } catch (error) {
      logger.error('Error in AI tool analysis:', error);
      return null;
    }
  }

  /**
   * Format tool results for AI context
   */
  formatToolResultsForAI(toolResults) {
    if (!toolResults || toolResults.length === 0) {
      return '';
    }

    let context = '\n\n=== TOOL EXECUTION RESULTS ===\n';
    
    for (const result of toolResults) {
      if (result.error) {
        context += `❌ ${result.tool}: ${result.error}\n`;
      } else {
        context += `✅ ${result.tool}: ${JSON.stringify(result.result)}\n`;
      }
    }
    
    context += '\nUse these results naturally in your response.\n';
    return context;
  }
}

// Export singleton instance
export const aiTools = new AITools();