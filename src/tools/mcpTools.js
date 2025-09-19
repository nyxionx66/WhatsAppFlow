import { whatsappClient } from '../whatsapp/whatsappClient.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('MCPTools');

export class MCPTools {
  constructor() {
    this.tools = new Map();
    this.contacts = new Map(); // Store user contacts
    this.outgoingMessageContexts = new Map(); // Store context of messages sent to contacts
    this.initializeTools();
  }

  /**
   * Initialize all MCP tools
   */
  initializeTools() {
    // Time and Date Tools
    this.registerTool('get_current_time', this.getCurrentTime.bind(this));
    this.registerTool('get_current_date', this.getCurrentDate.bind(this));
    this.registerTool('get_timestamp', this.getTimestamp.bind(this));
    
    // WhatsApp Tools
    this.registerTool('send_message_to_number', this.sendMessageToNumber.bind(this));
    this.registerTool('send_message_to_contact', this.sendMessageToContact.bind(this));
    this.registerTool('delete_message', this.deleteMessage.bind(this));
    this.registerTool('get_chat_info', this.getChatInfo.bind(this));
    this.registerTool('set_typing_status', this.setTypingStatus.bind(this));
    
    // Contact Management Tools
    this.registerTool('store_contact', this.storeContact.bind(this));
    this.registerTool('get_contacts', this.getContacts.bind(this));
    this.registerTool('find_contact', this.findContact.bind(this));
    
    // System Tools
    this.registerTool('get_system_status', this.getSystemStatus.bind(this));
    this.registerTool('clear_chat_history', this.clearChatHistory.bind(this));
    
    // Memory Tools
    this.registerTool('get_user_memory', this.getUserMemory.bind(this));
    this.registerTool('get_user_memory_details', this.getUserMemoryDetails.bind(this));
    this.registerTool('store_memory', this.storeMemory.bind(this));
    
    // Emotional Intelligence Tools
    this.registerTool('analyze_emotional_state', this.analyzeEmotionalState.bind(this));
    
    // Utility Tools
    this.registerTool('generate_random_number', this.generateRandomNumber.bind(this));
    this.registerTool('calculate', this.calculate.bind(this));
    this.registerTool('format_text', this.formatText.bind(this));

    // Message Context Tools
    this.registerTool('store_outgoing_message_context', this.storeOutgoingMessageContext.bind(this));
    this.registerTool('get_outgoing_message_context', this.getOutgoingMessageContext.bind(this));
    this.registerTool('check_incoming_message_context', this.checkIncomingMessageContext.bind(this));

    logger.success(`${this.tools.size} MCP tools initialized`);
  }

  /**
   * Register a new tool
   */
  registerTool(name, handler) {
    this.tools.set(name, handler);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName, params = {}) {
    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Tool '${toolName}' not found`);
      }

      const result = await tool(params);
      return result;
    } catch (error) {
      logger.error(`Tool execution failed: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * Get list of available tools with descriptions
   */
  getAvailableTools() {
    return {
      // Time and Date Tools
      get_current_time: {
        description: "Get current time in Sri Lanka timezone",
        parameters: {
          format: "Optional format (12h/24h), default: 12h"
        }
      },
      get_current_date: {
        description: "Get current date in Sri Lanka",
        parameters: {
          format: "Optional format (short/long/iso), default: long"
        }
      },
      get_timestamp: {
        description: "Get current Unix timestamp",
        parameters: {}
      },
      
      // WhatsApp Tools
      send_message_to_number: {
        description: "Send a message to a specific WhatsApp number",
        parameters: {
          number: "Phone number with country code (e.g., 94771234567)",
          message: "Message text to send"
        }
      },
      send_message_to_contact: {
        description: "Send a message to a stored contact",
        parameters: {
          contactName: "Name of the stored contact",
          message: "Message text to send",
          userId: "User ID who owns the contact"
        }
      },
      delete_message: {
        description: "Delete a message by its ID",
        parameters: {
          messageId: "Message ID to delete",
          chatId: "Chat ID where the message is located"
        }
      },
      get_chat_info: {
        description: "Get information about a chat",
        parameters: {
          chatId: "Chat ID to get info for"
        }
      },
      set_typing_status: {
        description: "Set typing indicator for a chat",
        parameters: {
          chatId: "Chat ID",
          isTyping: "true/false"
        }
      },
      
      // Contact Management Tools
      store_contact: {
        description: "Store a contact with name, number and relationship",
        parameters: {
          userId: "User ID who owns the contact",
          contactName: "Name of the contact",
          contactNumber: "Phone number",
          relationship: "Relationship type (friend/crush/family/etc)"
        }
      },
      get_contacts: {
        description: "Get all stored contacts for a user",
        parameters: {
          userId: "User ID"
        }
      },
      find_contact: {
        description: "Find a contact by name",
        parameters: {
          userId: "User ID",
          contactName: "Name to search for"
        }
      },
      
      // System Tools
      get_system_status: {
        description: "Get current system status and statistics",
        parameters: {}
      },
      clear_chat_history: {
        description: "Clear chat history for a user",
        parameters: {
          userId: "User ID to clear history for"
        }
      },
      get_user_memory: {
        description: "Get comprehensive memory profile for a user",
        parameters: {
          userId: "User ID to get memory for"
        }
      },
      get_user_memory_details: {
        description: "Get specific details from user's memory profile",
        parameters: {
          userId: "User ID",
          category: "Memory category (personalInfo, relationships, academicInfo, emotionalProfile, etc.)",
          subcategory: "Optional subcategory within the category"
        }
      },
      store_memory: {
        description: "Store specific memory information for a user",
        parameters: {
          userId: "User ID",
          category: "Memory category (personalInfo, relationships, academicInfo, etc.)",
          data: "Memory data to store"
        }
      },
      
      // Emotional Intelligence
      analyze_emotional_state: {
        description: "Analyze and store emotional context",
        parameters: {
          userId: "User ID",
          emotionalContext: "Emotional context to analyze"
        }
      },
      
      // Utility Tools
      generate_random_number: {
        description: "Generate a random number",
        parameters: {
          min: "Minimum value (default: 1)",
          max: "Maximum value (default: 100)"
        }
      },
      calculate: {
        description: "Perform mathematical calculations",
        parameters: {
          expression: "Mathematical expression to evaluate"
        }
      },
      format_text: {
        description: "Format text in various ways",
        parameters: {
          text: "Text to format",
          style: "Format style (uppercase/lowercase/title/reverse)"
        }
      },
      
      // Message Context Tools
      store_outgoing_message_context: {
        description: "Store context for messages sent to contacts",
        parameters: {
          userId: "User ID who sent the message",
          contactNumber: "Contact's phone number",
          context: "Message context object with purpose, relationship, etc."
        }
      },
      get_outgoing_message_context: {
        description: "Get context for previous messages sent to a contact",
        parameters: {
          userId: "User ID",
          contactNumber: "Contact's phone number"
        }
      },
      check_incoming_message_context: {
        description: "Check if an incoming message is a reply to a previous outgoing message",
        parameters: {
          userId: "User ID",
          senderNumber: "Number of the person who sent the message",
          messageText: "The incoming message text"
        }
      }
    };
  }

  // ==================== TIME AND DATE TOOLS ====================

  async getCurrentTime(params = {}) {
    const { format = '12h' } = params;
    const now = new Date();
    const sriLankaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Colombo"}));
    
    if (format === '24h') {
      return sriLankaTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } else {
      return sriLankaTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
  }

  async getCurrentDate(params = {}) {
    const { format = 'long' } = params;
    const now = new Date();
    const sriLankaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Colombo"}));
    
    switch (format) {
      case 'short':
        return sriLankaTime.toLocaleDateString('en-US');
      case 'iso':
        return sriLankaTime.toISOString().split('T')[0];
      case 'long':
      default:
        return sriLankaTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
    }
  }

  async getTimestamp() {
    return Math.floor(Date.now() / 1000);
  }

  // ==================== WHATSAPP TOOLS ====================

  async sendMessageToNumber(params) {
    const { number, message } = params;
    
    if (!number || !message) {
      throw new Error('Number and message are required');
    }

    // Format number to WhatsApp JID format
    const formattedNumber = number.replace(/[^\d]/g, '');
    const jid = `${formattedNumber}@s.whatsapp.net`;
    
    logger.info(`Sending message to ${number} (${jid}): ${message}`);
    await whatsappClient.sendMessage(jid, message);
    
    return {
      success: true,
      message: `Message sent to ${number}`,
      jid: jid
    };
  }

  async sendMessageToContact(params) {
    const { contactName, message, userId, purpose, context } = params;
    
    if (!contactName || !message || !userId) {
      throw new Error('Contact name, message, and user ID are required');
    }

    const contact = await this.findContact({ userId, contactName });
    if (!contact) {
      throw new Error(`Contact '${contactName}' not found`);
    }

    // Store the message context for tracking
    await this.storeOutgoingMessageContext({
      userId,
      contactNumber: contact.contactNumber,
      context: {
        contactName,
        message,
        purpose: purpose || 'general',
        context: context || 'user_requested',
        timestamp: new Date().toISOString(),
        relationship: contact.relationship
      }
    });

    const result = await this.sendMessageToNumber({
      number: contact.contactNumber,
      message: message
    });

    return {
      ...result,
      purpose,
      context,
      contactName
    };
  }

  async deleteMessage(params) {
    const { messageId, chatId } = params;
    
    if (!messageId || !chatId) {
      throw new Error('Message ID and Chat ID are required');
    }

    try {
      await whatsappClient.deleteMessage(chatId, messageId);
      return {
        success: true,
        message: 'Message deleted successfully'
      };
    } catch (error) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  async getChatInfo(params) {
    const { chatId } = params;
    
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    try {
      const info = await whatsappClient.getChatInfo(chatId);
      return info;
    } catch (error) {
      throw new Error(`Failed to get chat info: ${error.message}`);
    }
  }

  async setTypingStatus(params) {
    const { chatId, isTyping = true } = params;
    
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    await whatsappClient.sendTyping(chatId, isTyping);
    
    return {
      success: true,
      message: `Typing status set to ${isTyping} for ${chatId}`
    };
  }

  // ==================== CONTACT MANAGEMENT TOOLS ====================

  async storeContact(params) {
    const { userId, contactName, contactNumber, relationship = 'friend' } = params;
    
    if (!userId || !contactName || !contactNumber) {
      throw new Error('User ID, contact name, and contact number are required');
    }

    if (!this.contacts.has(userId)) {
      this.contacts.set(userId, new Map());
    }

    const userContacts = this.contacts.get(userId);
    userContacts.set(contactName.toLowerCase(), {
      contactName,
      contactNumber,
      relationship,
      dateAdded: new Date().toISOString()
    });

    return {
      success: true,
      message: `Contact '${contactName}' stored successfully`,
      contact: {
        contactName,
        contactNumber,
        relationship
      }
    };
  }

  async getContacts(params) {
    const { userId } = params;
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    const userContacts = this.contacts.get(userId);
    if (!userContacts) {
      return [];
    }

    return Array.from(userContacts.values());
  }

  async findContact(params) {
    const { userId, contactName } = params;
    
    if (!userId || !contactName) {
      throw new Error('User ID and contact name are required');
    }

    const userContacts = this.contacts.get(userId);
    if (!userContacts) {
      return null;
    }

    return userContacts.get(contactName.toLowerCase()) || null;
  }

  // ==================== SYSTEM TOOLS ====================

  async getSystemStatus() {
    const { chatbotService } = await import('../services/chatbotService.js');
    return chatbotService.getStatus();
  }

  async clearChatHistory(params) {
    const { userId } = params;
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { jsonDb } = await import('../database/jsonDb.js');
    await jsonDb.clearMessagesForSender(userId);
    
    return {
      success: true,
      message: `Chat history cleared for ${userId}`
    };
  }

  async getUserMemory(params) {
    const { userId } = params;
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { memoryManager } = await import('../database/memoryManager.js');
    const memory = await memoryManager.getUserMemory(userId);
    
    return {
      success: true,
      memory: memory
    };
  }

  async getUserMemoryDetails(params) {
    const { userId, category, subcategory } = params;
    
    if (!userId || !category) {
      throw new Error('User ID and category are required');
    }

    const { memoryManager } = await import('../database/memoryManager.js');
    const memory = await memoryManager.getUserMemory(userId);
    
    if (!memory[category]) {
      return null;
    }

    if (subcategory) {
      return memory[category][subcategory] || null;
    }

    return memory[category];
  }

  async storeMemory(params) {
    const { userId, category, data } = params;
    
    if (!userId || !category || !data) {
      throw new Error('User ID, category, and data are required');
    }

    const { memoryManager } = await import('../database/memoryManager.js');
    await memoryManager.updateMemory(userId, category, data, true);
    
    return {
      success: true,
      message: `Memory stored for ${userId} in category ${category}`
    };
  }

  async analyzeEmotionalState(params) {
    const { userId, emotionalContext } = params;
    
    if (!userId || !emotionalContext) {
      throw new Error('User ID and emotional context are required');
    }

    const { jsonDb } = await import('../database/jsonDb.js');
    await jsonDb.storeEmotionalContext(userId, emotionalContext);

    // Also store in memory system
    const { memoryManager } = await import('../database/memoryManager.js');
    await memoryManager.storeEmotionalContext(userId, { 
      mood: emotionalContext.mood,
      stressLevel: emotionalContext.stressLevel,
      traits: emotionalContext.traits
    });
    
    return {
      success: true,
      message: 'Emotional context analyzed and stored',
      context: emotionalContext
    };
  }

  // ==================== UTILITY TOOLS ====================

  async generateRandomNumber(params = {}) {
    const { min = 1, max = 100 } = params;
    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
    
    return {
      number: randomNum,
      range: `${min}-${max}`
    };
  }

  async calculate(params) {
    const { expression } = params;
    
    if (!expression) {
      throw new Error('Mathematical expression is required');
    }

    try {
      // Simple calculator - only allow basic math operations for security
      const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      
      return {
        expression: expression,
        result: result
      };
    } catch (error) {
      throw new Error(`Invalid mathematical expression: ${error.message}`);
    }
  }

  async formatText(params) {
    const { text, style } = params;
    
    if (!text) {
      throw new Error('Text is required');
    }

    let formatted;
    switch (style?.toLowerCase()) {
      case 'uppercase':
        formatted = text.toUpperCase();
        break;
      case 'lowercase':
        formatted = text.toLowerCase();
        break;
      case 'title':
        formatted = text.replace(/\w\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        break;
      case 'reverse':
        formatted = text.split('').reverse().join('');
        break;
      default:
        formatted = text;
    }

    return {
      original: text,
      formatted: formatted,
      style: style || 'none'
    };
  }

  // ==================== MESSAGE CONTEXT TOOLS ====================

  async storeOutgoingMessageContext(params) {
    const { userId, contactNumber, context } = params;
    
    if (!userId || !contactNumber || !context) {
      throw new Error('User ID, contact number, and context are required');
    }

    if (!this.outgoingMessageContexts.has(userId)) {
      this.outgoingMessageContexts.set(userId, new Map());
    }

    const userContexts = this.outgoingMessageContexts.get(userId);
    
    // Store context with timestamp
    const contextWithMeta = {
      ...context,
      storedAt: new Date().toISOString(),
      isActive: true // Mark as active until resolved
    };

    if (!userContexts.has(contactNumber)) {
      userContexts.set(contactNumber, []);
    }

    userContexts.get(contactNumber).unshift(contextWithMeta);

    // Keep only last 10 contexts per contact
    if (userContexts.get(contactNumber).length > 10) {
      userContexts.set(contactNumber, userContexts.get(contactNumber).slice(0, 10));
    }

    return {
      success: true,
      message: 'Message context stored successfully'
    };
  }

  async getOutgoingMessageContext(params) {
    const { userId, contactNumber } = params;
    
    if (!userId || !contactNumber) {
      throw new Error('User ID and contact number are required');
    }

    const userContexts = this.outgoingMessageContexts.get(userId);
    if (!userContexts || !userContexts.has(contactNumber)) {
      return [];
    }

    return userContexts.get(contactNumber) || [];
  }

  async checkIncomingMessageContext(params) {
    const { userId, senderNumber, messageText } = params;
    
    if (!userId || !senderNumber || !messageText) {
      throw new Error('User ID, sender number, and message text are required');
    }

    // Format sender number to match stored format
    const formattedSender = senderNumber.replace(/[^\d]/g, '');
    
    const userContexts = this.outgoingMessageContexts.get(userId);
    if (!userContexts) {
      return null;
    }

    // Check all stored numbers for a match
    for (const [storedNumber, contexts] of userContexts.entries()) {
      const cleanStoredNumber = storedNumber.replace(/[^\d]/g, '');
      
      if (cleanStoredNumber === formattedSender || 
          cleanStoredNumber.endsWith(formattedSender) || 
          formattedSender.endsWith(cleanStoredNumber)) {
        
        // Find the most recent active context
        const activeContext = contexts.find(ctx => ctx.isActive);
        
        if (activeContext) {
          // Mark context as resolved
          activeContext.isActive = false;
          activeContext.resolvedAt = new Date().toISOString();
          activeContext.replyReceived = messageText;
          
          return {
            hasContext: true,
            context: activeContext,
            contactName: activeContext.contactName,
            purpose: activeContext.purpose,
            originalMessage: activeContext.message,
            relationship: activeContext.relationship,
            timeSinceSent: Math.floor((Date.now() - new Date(activeContext.timestamp).getTime()) / (1000 * 60)) // minutes
          };
        }
      }
    }

    return {
      hasContext: false,
      message: 'No active outgoing message context found for this sender'
    };
  }
}

// Export singleton instance
export const mcpTools = new MCPTools();