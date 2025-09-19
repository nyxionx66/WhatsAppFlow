import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/config.js';
import { FileUtils } from '../utils/fileUtils.js';
import { createModuleLogger } from '../utils/logger.js';
import { performanceMonitor } from '../utils/performanceMonitor.js';

const logger = createModuleLogger('JsonDatabase');

export class JsonDatabase {
  constructor() {
    this.chatHistoryFile = config.paths.chatHistoryFile;
    this.chatHistory = new Map();
    this.isInitialized = false;
    this.saveQueue = new Map(); // Queue for batched saves
    this.saveTimeout = null;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Initialize database
   */
  async initialize() {
    try {
      await this.ensureDataDirectory();
      await this.loadChatHistory();
      this.isInitialized = true;
      
      // Start periodic cleanup
      this.startPeriodicCleanup();
      
      logger.success('Database initialized successfully');
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    const dataDir = path.dirname(this.chatHistoryFile);
    try {
      await FileUtils.ensureDir(dataDir);
    } catch (error) {
      logger.error('Failed to create data directory:', error);
      throw error;
    }
  }

  /**
   * Load chat history from file
   */
  async loadChatHistory() {
    const startTime = Date.now();
    
    try {
      const data = await fs.readFile(this.chatHistoryFile, 'utf8');
      const parsed = JSON.parse(data);
      
      // Convert to Map for better performance
      this.chatHistory = new Map(Object.entries(parsed));
      
      const loadTime = Date.now() - startTime;
      logger.info(`Chat history loaded: ${this.chatHistory.size} conversations in ${loadTime}ms`);
      
      performanceMonitor.recordEvent('database_loaded', {
        conversationCount: this.chatHistory.size,
        loadTime
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('No existing chat history found, starting fresh');
        this.chatHistory = new Map();
      } else {
        logger.error('Failed to load chat history:', error);
        throw error;
      }
    }
  }

  /**
   * Save chat history to file with retry logic
   */
  async saveChatHistory(retryCount = 0) {
    try {
      const startTime = Date.now();
      
      // Convert Map to Object for JSON serialization
      const dataToSave = Object.fromEntries(this.chatHistory);
      const jsonData = JSON.stringify(dataToSave, null, 2);
      
      // Atomic write: write to temp file first, then rename
      const tempFile = `${this.chatHistoryFile}.tmp`;
      await fs.writeFile(tempFile, jsonData, 'utf8');
      await fs.rename(tempFile, this.chatHistoryFile);
      
      const saveTime = Date.now() - startTime;
      logger.debug(`Chat history saved in ${saveTime}ms (${this.chatHistory.size} conversations)`);
      
      performanceMonitor.recordEvent('database_saved', {
        conversationCount: this.chatHistory.size,
        saveTime
      });
      
    } catch (error) {
      if (retryCount < this.maxRetries) {
        logger.warn(`Save failed, retrying (${retryCount + 1}/${this.maxRetries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.saveChatHistory(retryCount + 1);
      } else {
        logger.error('Failed to save chat history after retries:', error);
        performanceMonitor.recordEvent('database_save_failed', { error: error.message });
        throw error;
      }
    }
  }

  /**
   * Batched save to improve performance
   */
  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(async () => {
      try {
        await this.saveChatHistory();
      } catch (error) {
        logger.error('Scheduled save failed:', error);
      }
    }, 5000); // Save after 5 seconds of inactivity
  }

  /**
   * Add message to chat history
   */
  async addMessage(senderId, role, content, metadata = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const startTime = Date.now();
      
      // Initialize sender's conversation if not exists
      if (!this.chatHistory.has(senderId)) {
        this.chatHistory.set(senderId, {
          messages: [],
          metadata: {
            firstMessageTime: new Date().toISOString(),
            lastMessageTime: new Date().toISOString(),
            messageCount: 0
          }
        });
      }

      const conversation = this.chatHistory.get(senderId);
      const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const message = {
        id: messageId,
        role,
        content,
        timestamp: new Date().toISOString(),
        metadata: {
          ...metadata,
          processingTime: Date.now() - startTime
        }
      };

      conversation.messages.push(message);
      conversation.metadata.lastMessageTime = message.timestamp;
      conversation.metadata.messageCount = conversation.messages.length;

      // Keep only recent messages based on config
      if (conversation.messages.length > config.bot.maxChatHistory) {
        const excessMessages = conversation.messages.length - config.bot.maxChatHistory;
        conversation.messages.splice(0, excessMessages);
        logger.debug(`Trimmed ${excessMessages} old messages for ${senderId}`);
      }

      // Schedule batched save
      this.scheduleSave();
      
      const processingTime = Date.now() - startTime;
      performanceMonitor.recordEvent('message_stored', {
        senderId,
        role,
        contentLength: content.length,
        processingTime
      });

      return messageId;
      
    } catch (error) {
      logger.error('Failed to add message:', error);
      performanceMonitor.recordEvent('message_store_failed', { 
        senderId, 
        role, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get conversation context for AI
   */
  async getConversationContext(senderId, includeSystemPrompt = false) {
    if (!this.chatHistory.has(senderId)) {
      return [];
    }

    try {
      const conversation = this.chatHistory.get(senderId);
      const messages = conversation.messages || [];
      
      // Convert to Gemini format
      const context = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
        timestamp: msg.timestamp
      }));

      // Limit context size for performance
      const maxContextSize = Math.min(config.bot.maxChatHistory, 50);
      return context.slice(-maxContextSize);
      
    } catch (error) {
      logger.error('Failed to get conversation context:', error);
      return [];
    }
  }

  /**
   * Get time context for user
   */
  async getTimeContext(senderId) {
    if (!this.chatHistory.has(senderId)) {
      return null;
    }

    try {
      const conversation = this.chatHistory.get(senderId);
      const lastMessageTime = conversation.metadata?.lastMessageTime;
      
      if (!lastMessageTime) return null;

      const now = new Date();
      const lastMessage = new Date(lastMessageTime);
      const timeDiff = now - lastMessage;
      const minutesSince = Math.floor(timeDiff / (1000 * 60));
      
      const sriLankaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Colombo"}));
      const hour = sriLankaTime.getHours();
      
      return {
        currentTime: sriLankaTime.toLocaleString('en-US'),
        currentTimeOfDay: this.getTimeOfDay(hour),
        timeSinceLastMessage: minutesSince,
        isLateNight: hour >= 23 || hour <= 5,
        isStudyTime: hour >= 19 && hour <= 22,
        isMealTime: [7, 8, 12, 13, 19, 20].includes(hour),
        dayOfWeek: sriLankaTime.toLocaleDateString('en-US', { weekday: 'long' })
      };
      
    } catch (error) {
      logger.error('Failed to get time context:', error);
      return null;
    }
  }

  /**
   * Get time of day description
   */
  getTimeOfDay(hour) {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Store emotional context
   */
  async storeEmotionalContext(senderId, emotionalData) {
    if (!this.chatHistory.has(senderId)) {
      this.chatHistory.set(senderId, { messages: [], metadata: {} });
    }

    const conversation = this.chatHistory.get(senderId);
    if (!conversation.metadata.emotionalProfile) {
      conversation.metadata.emotionalProfile = [];
    }

    conversation.metadata.emotionalProfile.push({
      ...emotionalData,
      timestamp: new Date().toISOString()
    });

    // Keep only recent emotional data
    if (conversation.metadata.emotionalProfile.length > 20) {
      conversation.metadata.emotionalProfile = conversation.metadata.emotionalProfile.slice(-20);
    }

    this.scheduleSave();
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(senderId) {
    if (!this.chatHistory.has(senderId)) {
      return null;
    }

    const conversation = this.chatHistory.get(senderId);
    const messages = conversation.messages || [];
    
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    return {
      totalMessages: messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      firstMessage: conversation.metadata?.firstMessageTime,
      lastMessage: conversation.metadata?.lastMessageTime,
      averageResponseTime: this.calculateAverageResponseTime(messages)
    };
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime(messages) {
    const responseTimes = [];
    
    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];
      
      if (current.role === 'assistant' && previous.role === 'user') {
        const responseTime = new Date(current.timestamp) - new Date(previous.timestamp);
        responseTimes.push(responseTime);
      }
    }
    
    if (responseTimes.length === 0) return 0;
    
    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    return Math.round(average / 1000); // Convert to seconds
  }

  /**
   * Clear messages for a sender
   */
  async clearMessagesForSender(senderId) {
    try {
      if (this.chatHistory.has(senderId)) {
        this.chatHistory.delete(senderId);
        await this.saveChatHistory();
        logger.info(`Cleared chat history for ${senderId}`);
      }
    } catch (error) {
      logger.error('Failed to clear messages:', error);
      throw error;
    }
  }

  /**
   * Start periodic cleanup of old data
   */
  startPeriodicCleanup() {
    // Run cleanup every 6 hours
    setInterval(async () => {
      await this.performCleanup();
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Perform database cleanup
   */
  async performCleanup() {
    try {
      const startTime = Date.now();
      let cleanedConversations = 0;
      let cleanedMessages = 0;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days of data
      
      for (const [senderId, conversation] of this.chatHistory.entries()) {
        const lastMessageTime = new Date(conversation.metadata?.lastMessageTime);
        
        // Remove conversations older than 30 days with no recent activity
        if (lastMessageTime < cutoffDate && conversation.messages.length < 10) {
          this.chatHistory.delete(senderId);
          cleanedConversations++;
          continue;
        }
        
        // Clean old messages within active conversations
        const oldMessageCount = conversation.messages.length;
        conversation.messages = conversation.messages.filter(msg => 
          new Date(msg.timestamp) > cutoffDate
        );
        cleanedMessages += oldMessageCount - conversation.messages.length;
      }
      
      if (cleanedConversations > 0 || cleanedMessages > 0) {
        await this.saveChatHistory();
        const cleanupTime = Date.now() - startTime;
        logger.info(`Cleanup completed: ${cleanedConversations} conversations, ${cleanedMessages} messages removed in ${cleanupTime}ms`);
        
        performanceMonitor.recordEvent('database_cleanup', {
          cleanedConversations,
          cleanedMessages,
          cleanupTime
        });
      }
      
    } catch (error) {
      logger.error('Database cleanup failed:', error);
    }
  }

  /**
   * Get database statistics
   */
  getStats() {
    const totalConversations = this.chatHistory.size;
    let totalMessages = 0;
    let oldestMessage = null;
    let newestMessage = null;

    for (const conversation of this.chatHistory.values()) {
      totalMessages += conversation.messages?.length || 0;
      
      const firstMsg = conversation.metadata?.firstMessageTime;
      const lastMsg = conversation.metadata?.lastMessageTime;
      
      if (firstMsg && (!oldestMessage || firstMsg < oldestMessage)) {
        oldestMessage = firstMsg;
      }
      
      if (lastMsg && (!newestMessage || lastMsg > newestMessage)) {
        newestMessage = lastMsg;
      }
    }

    return {
      totalConversations,
      totalMessages,
      oldestMessage,
      newestMessage,
      isInitialized: this.isInitialized,
      fileName: this.chatHistoryFile
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Cancel any pending saves
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }
      
      // Final save
      if (this.isInitialized && this.chatHistory.size > 0) {
        await this.saveChatHistory();
      }
      
      logger.info('Database cleanup completed');
    } catch (error) {
      logger.error('Database cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const jsonDb = new JsonDatabase();