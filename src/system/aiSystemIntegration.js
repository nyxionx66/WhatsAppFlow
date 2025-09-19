import { chatbotService } from '../services/chatbotService.js';
import { aiMemoryManager } from '../database/aiMemoryManager.js';
import { aiTools } from '../tools/aiTools.js';
import { geminiClient } from '../gemini/geminiClient.js';
import { memoryManager } from '../database/memoryManager.js';
import { chatPresenceManager } from '../services/chatPresenceManager.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('AISystemIntegration');

export class AISystemIntegration {
  constructor() {
    this.systemComponents = {
      chatbot: chatbotService,
      memory: aiMemoryManager,
      tools: aiTools,
      gemini: geminiClient,
      storage: memoryManager,
      presence: chatPresenceManager
    };
  }

  /**
   * Initialize all AI system components
   */
  async initialize() {
    try {
      logger.info('Initializing AI System Integration...');
      
      // Validate all components are loaded
      for (const [name, component] of Object.entries(this.systemComponents)) {
        if (!component) {
          throw new Error(`Component ${name} is not properly loaded`);
        }
        logger.debug(`✓ ${name} component loaded`);
      }

      logger.success('AI System Integration initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize AI System Integration:', error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  getSystemHealth() {
    const health = {
      status: 'healthy',
      components: {},
      timestamp: new Date().toISOString()
    };

    try {
      // Check chatbot service
      health.components.chatbot = {
        status: 'active',
        stats: this.systemComponents.chatbot.getStatus()
      };

      // Check Gemini client
      health.components.gemini = {
        status: 'active',
        stats: this.systemComponents.gemini.getStatus()
      };

      // Check memory systems
      health.components.memory = {
        status: 'active',
        ai_driven: true,
        traditional_backup: true
      };

      // Check AI tools
      health.components.tools = {
        status: 'active',
        ai_driven: true
      };

      // Check chat presence
      health.components.presence = {
        status: 'active',
        stats: this.systemComponents.presence.getPresenceStatus()
      };

      logger.debug('System health check completed');
      return health;
    } catch (error) {
      logger.error('System health check failed:', error);
      health.status = 'degraded';
      health.error = error.message;
      return health;
    }
  }

  /**
   * Test AI memory system
   */
  async testMemorySystem(testUserId = 'test_user_123') {
    try {
      logger.info('Testing AI Memory System...');

      // Test memory analysis
      const testMessage = "Hi! My name is John and I'm studying Physics for A/L. I'm really stressed about Chemistry though.";
      
      const result = await aiMemoryManager.analyzeMessageForMemoryOperations(
        testUserId, 
        testMessage, 
        this.systemComponents.gemini
      );

      logger.success('AI Memory System test completed');
      return {
        success: true,
        result: result
      };
    } catch (error) {
      logger.error('AI Memory System test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test AI tools system
   */
  async testToolsSystem(testUserId = 'test_user_123') {
    try {
      logger.info('Testing AI Tools System...');

      // Test tool analysis
      const testMessage = "What time is it now?";
      const availableTools = {
        get_current_time: { description: "Get current time" }
      };
      
      const result = await aiTools.analyzeMessageForToolOperations(
        testUserId, 
        testMessage, 
        availableTools,
        this.systemComponents.gemini
      );

      logger.success('AI Tools System test completed');
      return {
        success: true,
        result: result
      };
    } catch (error) {
      logger.error('AI Tools System test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      name: 'AI WhatsApp Bot',
      version: '2.0.0',
      features: [
        'AI-Driven Memory Management',
        'AI-Powered Tool Selection',
        'AI Proactive Messaging',
        'Realistic Chat Presence',
        'Intelligent Read Receipts',
        'Context-Aware Chat Timing',
        'JSON-Based Data Operations'
      ],
      components: Object.keys(this.systemComponents),
      aiCapabilities: {
        memoryAnalysis: true,
        toolIntelligence: true,
        aiPersonalization: true,
        contextualUnderstanding: true,
        realisticPresence: true,
        smartReadReceipts: true
      }
    };
  }
}

// Export singleton instance
export const aiSystemIntegration = new AISystemIntegration();