import { jsonDb } from '../database/jsonDb.js';
import { geminiClient } from '../gemini/geminiClient.js';
import { whatsappClient } from '../whatsapp/whatsappClient.js';
import { config } from '../config/config.js';
import { createModuleLogger } from '../utils/logger.js';
import { performanceMonitor } from '../utils/performanceMonitor.js';
import { aiMemoryManager } from '../database/aiMemoryManager.js';
import { aiTools } from '../tools/aiTools.js';
import { mcpTools } from '../tools/mcpTools.js';
import { memoryManager } from '../database/memoryManager.js';
import { chatPresenceManager } from './chatPresenceManager.js';
import { personaManager } from '../system/personaManager.js';
import { proactiveEngagementManager } from '../system/proactiveEngagementManager.js';
import { predictiveAI } from '../system/predictiveAI.js';

const logger = createModuleLogger('ChatbotService');

export class ChatbotService {
  constructor() {
    this.processingMessages = new Set();
    this.activeUsers = new Set();
    this.lastProactiveMessage = new Map();
    this.messageQueue = new Map(); // Queue for handling message bursts
    this.rateLimiter = new Map(); // Rate limiting per user
    this.setupMessageHandler();
  }

  /**
   * Set up message handler for WhatsApp client
   */
  setupMessageHandler() {
    whatsappClient.onMessage(async (messageInfo) => {
      await this.queueMessage(messageInfo);
    });
  }

  /**
   * Queues a message for processing and starts the processor if not running.
   */
  async queueMessage(messageInfo) {
    const { sender, senderName } = messageInfo;

    if (!this.messageQueue.has(sender)) {
      this.messageQueue.set(sender, []);
    }
    this.messageQueue.get(sender).push(messageInfo);
    logger.debug(`Message from ${senderName} queued. Queue size: ${this.messageQueue.get(sender).length}`);

    if (!this.processingMessages.has(sender)) {
      this._processQueue(sender);
    }
  }

  /**
   * Processes the message queue for a given sender.
   */
  async _processQueue(sender) {
    this.processingMessages.add(sender);
    logger.debug(`Started processing queue for ${sender}`);

    try {
      while (this.messageQueue.get(sender)?.length > 0) {
        const messageInfo = this.messageQueue.get(sender).shift();
        await this._handleSingleMessage(messageInfo);
      }
    } catch (error) {
      logger.error(`Error processing message queue for ${sender}:`, error);
    } finally {
      this.processingMessages.delete(sender);
      this.messageQueue.delete(sender);
      logger.debug(`Finished processing queue for ${sender}`);
    }
  }


  /**
   * Handle a single WhatsApp message with the enhanced AI-driven approach.
   * This was the original handleIncomingMessage method.
   */
  async _handleSingleMessage(messageInfo) {
    const startTime = Date.now();
    const { sender, text, senderName, isGroup, quotedMessage, hasQuote } = messageInfo;

    try {
      // In groups, only respond if mentioned by name
      if (isGroup) {
        const botName = config.persona.name.toLowerCase();
        const messageText = text.toLowerCase();

        if (!messageText.includes(botName)) {
          logger.debug(`Skipping group message because bot name "${config.persona.name}" was not mentioned.`);
          return;
        }
      }

      // Check rate limiting
      if (this.isRateLimited(sender)) {
        logger.warn(`Rate limited user: ${senderName}`);
        return;
      }

      // The old per-message lock is removed, as the queue system handles this.

      const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
      logger.info(`Processing message from ${senderName}: ${preview}`);

      // Update user activity
      this.activeUsers.add(sender);
      proactiveEngagementManager.registerActiveUser(sender);
      this.updateRateLimit(sender);

      // Handle realistic chat presence
      await this.handleChatPresence(messageInfo);

      // Process message content
      const processedContent = await this.processMessageContent(sender, text, quotedMessage, hasQuote);

      // Show typing indicator
      await whatsappClient.sendTyping(sender, true);

      // Apply thinking delay for natural behavior
      if (config.bot.thinkingDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, config.bot.thinkingDelay));
      }

      // Store user message
      await jsonDb.addMessage(sender, 'user', processedContent.finalText, {
        senderName,
        messageId: messageInfo.id,
        quotedMessage: quotedMessage,
        hasQuote: hasQuote,
        originalText: text,
        processingMetadata: processedContent.metadata
      });

      // Generate AI response
      const response = await this.generateAIResponse(sender, processedContent);

      // Clean and send response
      const cleanResponse = this.cleanResponse(response);
      await jsonDb.addMessage(sender, 'assistant', cleanResponse);

      await whatsappClient.sendTyping(sender, false);
      await whatsappClient.sendMessage(sender, cleanResponse);

      // Update presence and performance metrics
      chatPresenceManager.onBotResponse(sender);
      
      const endTime = Date.now();
      performanceMonitor.recordMessageProcessing(startTime, endTime, true);

      logger.success(`Enhanced AI reply sent to ${senderName} (${endTime - startTime}ms)`);

    } catch (err) {
      logger.error(`Failed to process message from ${senderName}:`, err);

      await whatsappClient.sendTyping(sender, false);
      const errorMessage = this.getErrorMessage(err);
      await whatsappClient.sendMessage(sender, errorMessage);

      const endTime = Date.now();
      performanceMonitor.recordMessageProcessing(startTime, endTime, false);
      performanceMonitor.recordEvent('error_occurred', {
        context: 'message_processing',
        error: err.message,
        user: senderName
      });
    }
  }

  /**
   * Check if user is rate limited
   */
  isRateLimited(userId) {
    const now = Date.now();
    const userLimits = this.rateLimiter.get(userId) || { count: 0, resetTime: now };
    
    // Reset if window expired (1 minute)
    if (now > userLimits.resetTime) {
      userLimits.count = 0;
      userLimits.resetTime = now + 60000; // 1 minute window
    }
    
    // Allow up to 10 messages per minute
    if (userLimits.count >= 10) {
      return true;
    }
    
    return false;
  }

  /**
   * Update rate limit for user
   */
  updateRateLimit(userId) {
    const now = Date.now();
    const userLimits = this.rateLimiter.get(userId) || { count: 0, resetTime: now + 60000 };
    
    userLimits.count++;
    this.rateLimiter.set(userId, userLimits);
  }

  /**
   * Handle chat presence realistically
   */
  async handleChatPresence(messageInfo) {
    try {
      await chatPresenceManager.handleMessagePresence(messageInfo);
      chatPresenceManager.onUserMessage(messageInfo.sender);
    } catch (error) {
      logger.debug('Chat presence handling failed:', error);
    }
  }

  /**
   * Process message content with AI enhancements
   */
  async processMessageContent(sender, text, quotedMessage, hasQuote) {
    const metadata = {
      toolsProcessed: false,
      memoryProcessed: false,
      relationshipProcessed: false
    };

    let finalText = text;

    try {
      // Handle reply context
      if (hasQuote && quotedMessage) {
        const replyContext = this.formatReplyContext(quotedMessage);
        finalText = `${replyContext}\n\nUser's reply: ${text}`;
        metadata.hasReply = true;
      }

      // Process AI tools in background
      const toolResultsPromise = this.processToolsWithAI(sender, text);
      
      // Process memory operations in background
      const memoryProcessingPromise = this.processMemoryInBackground(sender, text);
      
      // Process relationship and persona in background
      const relationshipProcessingPromise = this.processRelationshipAndPersona(sender, text);

      // Wait for tool results (quick operations)
      const toolResults = await Promise.race([
        toolResultsPromise,
        new Promise(resolve => setTimeout(() => resolve(null), 2000)) // 2s timeout
      ]);

      if (toolResults) {
        const toolContext = aiTools.formatToolResultsForAI(toolResults);
        finalText = `${finalText}${toolContext}`;
        metadata.toolsProcessed = true;
      }

      // Don't wait for background operations (they'll complete async)
      memoryProcessingPromise.then(() => metadata.memoryProcessed = true);
      relationshipProcessingPromise.then(() => metadata.relationshipProcessed = true);

      return { finalText, metadata };

    } catch (error) {
      logger.error('Error processing message content:', error);
      return { finalText, metadata };
    }
  }

  /**
   * Generate AI response with enhanced context
   */
  async generateAIResponse(sender, processedContent) {
    try {
      // Get conversation context
      const conversationHistory = await jsonDb.getConversationContext(sender, false);
      
      // Get memory and context data
      const [memorySummary, userMemory, timeContext] = await Promise.all([
        memoryManager.getMemorySummary(sender),
        memoryManager.getUserMemory(sender),
        jsonDb.getTimeContext(sender)
      ]);

      // Generate dynamic persona prompt
      const currentMood = userMemory.emotionalProfile?.currentMood;
      const personaPrompt = await personaManager.generatePersonaPrompt(sender, { userMood: currentMood });

      // Enhanced conversation history with persona
      const enhancedHistory = [
        {
          role: 'user',
          parts: [{ text: personaPrompt }]
        },
        {
          role: 'model',
          parts: [{ text: `I understand! I'm ${config.persona.name}, ready to chat with you as your friend!` }]
        },
        ...conversationHistory
      ];

      // Add time context to memory summary
      const aiMemorySummary = memorySummary + this.formatTimeContextForAI(timeContext);

      // Generate response with enhanced context
      const response = await geminiClient.generateContent(enhancedHistory, aiMemorySummary, userMemory);
      
      return response;

    } catch (error) {
      logger.error('AI response generation failed:', error);
      throw error;
    }
  }

  /**
   * Process memory operations in background using AI
   */
  async processMemoryInBackground(userId, userMessage) {
    try {
      // Run AI memory analysis in background with timeout
      const memoryPromise = aiMemoryManager.analyzeMessageForMemoryOperations(userId, userMessage, geminiClient);
      
      // Don't wait more than 3 seconds for memory processing
      await Promise.race([
        memoryPromise,
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      
    } catch (error) {
      logger.debug('Background memory processing error:', error);
    }
  }

  /**
   * Process relationship building and persona evolution
   */
  async processRelationshipAndPersona(userId, userMessage) {
    try {
      // Analyze relationship building opportunities
      const opportunities = await personaManager.analyzeRelationshipOpportunities(userId, userMessage);
      
      if (opportunities.length > 0) {
        await personaManager.processRelationshipOpportunities(userId, opportunities);
      }

      // Check for crisis indicators with enhanced keywords
      const crisisKeywords = [
        'depressed', 'want to die', 'hate myself', 'give up', 'can\'t handle', 
        'suicidal', 'end it all', 'no point', 'worthless', 'hopeless'
      ];
      
      const hasCrisisKeywords = crisisKeywords.some(keyword => 
        userMessage.toLowerCase().includes(keyword)
      );
      
      if (hasCrisisKeywords) {
        proactiveEngagementManager.markUserInCrisis(userId, 'high', 'Crisis keywords detected in conversation');
      }

      // Trigger predictive analysis for significant interactions
      if (opportunities.length > 0 || userMessage.length > 100) {
        // Run predictive analysis in background
        setTimeout(async () => {
          try {
            await predictiveAI.predictUserMood(userId, 12);
          } catch (error) {
            logger.debug('Predictive AI analysis error:', error);
          }
        }, 5000);
      }
      
    } catch (error) {
      logger.debug('Error in relationship and persona processing:', error);
    }
  }

  /**
   * Process tools using AI analysis
   */
  async processToolsWithAI(userId, userMessage) {
    try {
      const availableTools = mcpTools.getAvailableTools();
      return await aiTools.analyzeMessageForToolOperations(userId, userMessage, availableTools, geminiClient);
    } catch (error) {
      logger.debug('AI tool processing error:', error);
      return null;
    }
  }

  /**
   * Format reply context for AI understanding
   */
  formatReplyContext(quotedMessage) {
    if (!quotedMessage) return '';
    
    const sender = quotedMessage.isFromBot ? config.persona.name : 'User';
    return `[REPLYING TO ${sender.toUpperCase()}: "${quotedMessage.text}"]`;
  }

  /**
   * Format time context for AI understanding
   */
  formatTimeContextForAI(timeContext) {
    if (!timeContext) return '';

    let context = `\n\n=== REAL-TIME CONTEXT ===\n`;
    context += `Current time: ${timeContext.currentTime} (${timeContext.currentTimeOfDay})\n`;
    context += `Day: ${timeContext.dayOfWeek}\n`;
    
    if (timeContext.timeSinceLastMessage !== null) {
      context += `Time since last message: ${timeContext.timeSinceLastMessage} minutes ago\n`;
    }
    
    // Enhanced contextual awareness
    if (timeContext.isLateNight) {
      context += `WARNING: It's late night - user should probably be sleeping for A/L studies\n`;
    }
    
    if (timeContext.isMealTime) {
      context += `INFO: It's meal time - good time to ask about food\n`;
    }
    
    if (timeContext.isStudyTime) {
      context += `INFO: It's typical study time for A/L students\n`;
    }
    
    // Weekend vs weekday context
    const isWeekend = ['Saturday', 'Sunday'].includes(timeContext.dayOfWeek);
    if (isWeekend) {
      context += `INFO: It's weekend - more relaxed time\n`;
    } else {
      context += `INFO: It's a school day - consider academic context\n`;
    }
    
    context += `\nUse this timing information to respond naturally as a real friend would!\n`;
    return context;
  }

  /**
   * Clean response text with enhanced filtering
   */
  cleanResponse(response) {
    if (!response) return 'Sorry, mata response eka generate karanna bari una. Try again please!';
    
    // Remove JSON artifacts, debug info, and system messages
    let cleaned = response
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/\{[\s\S]*?\}/g, '')
      .replace(/MEMORY ANALYSIS[\s\S]*$/i, '')
      .replace(/TOOL ANALYSIS[\s\S]*$/i, '')
      .replace(/\[SYSTEM\][\s\S]*?\[\/SYSTEM\]/gi, '')
      .replace(/DEBUG:[\s\S]*$/i, '')
      .trim();
    
    // Remove excessive newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Ensure response isn't empty
    if (!cleaned || cleaned.length < 3) {
      return 'Hmm, mata mokak reply karanna ona kiyala confuse una. Try again?';
    }
    
    return cleaned;
  }

  /**
   * Get appropriate error message with variety
   */
  getErrorMessage(error) {
    const errorMessages = [
      'Aney sorry, mata mokak weda una! Try again please.',
      'Ehh, error wela! Mata brain freeze wela thiyenawa.',
      'Oops! Mata thoda issue ekak. Try again karanna?',
      'Sorry sorry, mata system eka hang wela. Eka try karanna!',
      'Mata thoda slow wela, sorry! Try again please?'
    ];
    
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
  }

  /**
   * Get comprehensive service status
   */
  getStatus() {
    return {
      // Core metrics
      activeUsers: this.activeUsers.size,
      processingMessages: this.processingMessages.size,
      rateLimitedUsers: this.rateLimiter.size,
      
      // Performance metrics
      performance: performanceMonitor.getStats(),
      
      // Core AI features
      aiMemory: true,
      aiTools: true,
      chatPresence: chatPresenceManager.getPresenceStatus(),
      
      // Enhanced AI systems
      personaSystem: {
        enabled: true,
        dynamicPersonality: config.features.dynamic.personality_evolution,
        relationshipTracking: config.features.dynamic.relationship_tracking,
        contextAdaptation: config.features.dynamic.context_adaptation
      },
      
      proactiveEngagement: {
        enabled: config.features.proactive.mental_health_checkins,
        ...proactiveEngagementManager.getStatus()
      },
      
      predictiveAI: {
        enabled: config.features.predictive.mood_analysis,
        ...predictiveAI.getStatus()
      },
      
      // Current persona configuration
      currentPersona: {
        name: config.persona.name,
        age: config.persona.age,
        location: `${config.persona.location.city}, ${config.persona.location.country}`,
        education: config.persona.education.level,
        traits: config.persona.personality_traits.slice(0, 5)
      },
      
      // Database stats
      database: jsonDb.getStats()
    };
  }

  /**
   * Cleanup service resources
   */
  async cleanup() {
    try {
      logger.info('Cleaning up chatbot service resources...');
      
      // Clear processing sets
      this.processingMessages.clear();
      this.activeUsers.clear();
      this.messageQueue.clear();
      this.rateLimiter.clear();
      
      logger.info('Chatbot service cleanup completed');
    } catch (error) {
      logger.error('Chatbot service cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const chatbotService = new ChatbotService();