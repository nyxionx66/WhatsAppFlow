import { memoryManager } from './memoryManager.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('AIMemoryManager');

export class AIMemoryManager {
  constructor() {
    this.processingQueue = new Map(); // Prevent concurrent processing
  }

  /**
   * Process AI memory decisions from JSON
   */
  async processAIMemoryDecisions(userId, memoryDecisions) {
    if (this.processingQueue.has(userId)) {
      logger.debug(`Memory processing already in progress for ${userId}`);
      return;
    }

    this.processingQueue.set(userId, true);

    try {
      if (!memoryDecisions || !memoryDecisions.memory_operations) {
        logger.debug('No memory operations found in AI response');
        return;
      }

      const operations = memoryDecisions.memory_operations;
      logger.info(`Processing ${operations.length} memory operations for ${userId}`);

      for (const operation of operations) {
        await this.executeMemoryOperation(userId, operation);
      }

      logger.success(`Completed ${operations.length} memory operations for ${userId}`);
    } catch (error) {
      logger.error('Error processing AI memory decisions:', error);
    } finally {
      this.processingQueue.delete(userId);
    }
  }

  /**
   * Execute individual memory operation
   */
  async executeMemoryOperation(userId, operation) {
    try {
      const { operation: op, category, subcategory, data, reason } = operation;

      if (!op || !category || !data) {
        logger.warn('Invalid memory operation format:', operation);
        return;
      }

      logger.debug(`Executing ${op} on ${category}${subcategory ? `.${subcategory}` : ''} for ${userId}: ${reason}`);

      switch (op.toLowerCase()) {
        case 'store':
          await this.storeMemoryData(userId, category, subcategory, data);
          break;
        case 'update':
          await this.updateMemoryData(userId, category, subcategory, data);
          break;
        case 'append':
          await this.appendMemoryData(userId, category, subcategory, data);
          break;
        case 'delete':
          await this.deleteMemoryData(userId, category, subcategory, data);
          break;
        default:
          logger.warn(`Unknown memory operation: ${op}`);
      }
    } catch (error) {
      logger.error('Error executing memory operation:', error);
    }
  }

  /**
   * Store new memory data
   */
  async storeMemoryData(userId, category, subcategory, data) {
    if (subcategory) {
      const memory = await memoryManager.getUserMemory(userId);
      if (!memory[category]) memory[category] = {};
      memory[category][subcategory] = data;
      await memoryManager.updateMemory(userId, category, memory[category]);
    } else {
      await memoryManager.updateMemory(userId, category, data, true);
    }
  }

  /**
   * Update existing memory data
   */
  async updateMemoryData(userId, category, subcategory, data) {
    if (subcategory) {
      const memory = await memoryManager.getUserMemory(userId);
      if (!memory[category]) memory[category] = {};
      memory[category][subcategory] = { ...memory[category][subcategory], ...data };
      await memoryManager.updateMemory(userId, category, memory[category]);
    } else {
      await memoryManager.updateMemory(userId, category, data, true);
    }
  }

  /**
   * Append to array-based memory data
   */
  async appendMemoryData(userId, category, subcategory, data) {
    if (Array.isArray(data)) {
      for (const item of data) {
        await memoryManager.addToMemoryArray(userId, category, subcategory || 'items', item);
      }
    } else {
      await memoryManager.addToMemoryArray(userId, category, subcategory || 'items', data);
    }
  }

  /**
   * Delete memory data
   */
  async deleteMemoryData(userId, category, subcategory, data) {
    const memory = await memoryManager.getUserMemory(userId);
    
    if (subcategory && memory[category] && memory[category][subcategory]) {
      if (data.key) {
        // Delete specific key
        delete memory[category][subcategory][data.key];
      } else {
        // Delete entire subcategory
        delete memory[category][subcategory];
      }
      await memoryManager.updateMemory(userId, category, memory[category]);
    } else if (!subcategory && data.key) {
      // Delete specific key from category
      delete memory[category][data.key];
      await memoryManager.updateMemory(userId, category, memory[category]);
    }
  }

  /**
   * Generate memory analysis prompt for AI
   */
  generateMemoryAnalysisPrompt(userMessage, currentMemory) {
    return `MEMORY ANALYSIS TASK:

Analyze the user's message and determine what information should be stored, updated, or modified in their memory profile.

USER MESSAGE: "${userMessage}"

CURRENT MEMORY PROFILE:
${JSON.stringify(currentMemory, null, 2)}

MEMORY CATEGORIES AVAILABLE:
- personalInfo: name, age, school, grade, subjects, hobbies, family, location
- relationships: friends, crushes, family, teachers (with names as keys)
- preferences: favoriteSubjects, dislikedSubjects, favoriteFood, favoriteMovies, favoriteMusic, favoriteColors
- emotionalProfile: currentMood, stressLevel, personalityTraits, emotionalPatterns, supportNeeds
- academicInfo: stream, currentGrade, strongSubjects, weakSubjects, examSchedule, studyHabits, academicGoals
- lifeEvents: importantDates, achievements, challenges, goals, recentEvents
- conversationContext: lastTopics, ongoingIssues, promisesToKeep, thingsToRemember, lastInteraction
- contacts: stored contact information

OPERATIONS AVAILABLE:
- store: Create new data
- update: Modify existing data (merge with current)
- append: Add to arrays/lists
- delete: Remove data

RESPOND WITH JSON ONLY:
{
  "memory_operations": [
    {
      "operation": "store|update|append|delete",
      "category": "category_name",
      "subcategory": "optional_subcategory",
      "data": {...},
      "reason": "why this operation is needed"
    }
  ]
}

ANALYSIS RULES:
1. Only create operations for information that is clearly mentioned or implied
2. Don't make assumptions about information not present
3. Update emotional state if clear emotional indicators are present
4. Store relationship information with proper names and context
5. Track academic progress, subjects, and educational context
6. Remember important life events, achievements, and goals
7. Store preferences when explicitly mentioned
8. Track ongoing issues or topics that need follow-up
9. If no memory-worthy information is found, return empty array: []

RESPOND WITH VALID JSON ONLY - NO OTHER TEXT.`;
  }

  /**
   * Ask AI to analyze message for memory operations
   */
  async analyzeMessageForMemoryOperations(userId, userMessage, geminiClient) {
    try {
      const currentMemory = await memoryManager.getUserMemory(userId);
      const analysisPrompt = this.generateMemoryAnalysisPrompt(userMessage, currentMemory);

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
        const memoryDecisions = JSON.parse(jsonMatch[0]);
        
        if (memoryDecisions.memory_operations && memoryDecisions.memory_operations.length > 0) {
          logger.info(`AI identified ${memoryDecisions.memory_operations.length} memory operations`);
          await this.processAIMemoryDecisions(userId, memoryDecisions);
        }
        
        return memoryDecisions;
      } else {
        logger.debug('No valid JSON found in AI memory analysis response');
        return { memory_operations: [] };
      }
    } catch (error) {
      logger.error('Error in AI memory analysis:', error);
      return { memory_operations: [] };
    }
  }

  /**
   * Generate context for AI about recent memory operations
   */
  getRecentMemoryContext(userId) {
    // This could be enhanced to track recent memory changes
    // for now, just return empty context
    return '';
  }
}

// Export singleton instance
export const aiMemoryManager = new AIMemoryManager();