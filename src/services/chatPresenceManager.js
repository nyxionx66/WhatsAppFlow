import { whatsappClient } from '../whatsapp/whatsappClient.js';
import { geminiClient } from '../gemini/geminiClient.js';
import { memoryManager } from '../database/memoryManager.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('ChatPresenceManager');

export class ChatPresenceManager {
  constructor() {
    this.activeChats = new Map(); // Track active chat sessions
    this.messageTimers = new Map(); // Track message read timers
    this.leaveTimers = new Map(); // Track when to leave chats
  }

  /**
   * Handle incoming message with realistic presence behavior
   */
  async handleMessagePresence(messageInfo) {
    const { sender, text, id: messageId } = messageInfo;
    
    try {
      // Cancel any existing leave timer for this chat
      this.cancelLeaveTimer(sender);
      
      // Mark chat as active
      this.activeChats.set(sender, {
        lastMessageTime: Date.now(),
        messageId: messageId,
        isActive: true
      });

      // Decide when to mark as read with AI
      const readDelay = await this.decideReadDelay(sender, text);
      
      // Schedule message to be marked as read
      this.scheduleMessageRead(sender, messageId, readDelay);
      
      // Decide if we should stay in chat after responding
      const shouldStayInChat = await this.shouldStayInChat(sender, text);
      
      if (shouldStayInChat) {
        logger.debug(`Staying in chat with ${sender} - conversation seems engaging`);
        // Set a timer to leave if user doesn't respond within 1 minute
        this.scheduleLeaveChat(sender, 60000); // 1 minute
      } else {
        logger.debug(`Will leave chat with ${sender} after responding`);
        // Leave shortly after responding
        this.scheduleLeaveChat(sender, this.getRandomDelay(3000, 8000)); // 3-8 seconds
      }

    } catch (error) {
      logger.error('Error handling message presence:', error);
    }
  }

  /**
   * AI decides when to mark message as read
   */
  async decideReadDelay(userId, messageText) {
    // Fixed 3-second delay for consistent behavior
    return 3000; // 3 seconds
  }

  /**
   * AI decides if we should stay in chat after responding
   */
  async shouldStayInChat(userId, messageText) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      
      const stayDecisionPrompt = `CHAT PRESENCE DECISION:

User message: "${messageText}"
User context: ${JSON.stringify({
        mood: memory.emotionalProfile.currentMood,
        relationship: this.getRelationshipContext(memory),
        recentTopics: memory.conversationContext.lastTopics?.slice(0, 3) || []
      }, null, 2)}

Should I stay online in this chat after responding? Consider:
- Is conversation engaging/fun/emotional?
- Does user seem to want to continue chatting?
- Are they asking questions or sharing important things?
- Is this a casual "thanks" or conversation-ending message?
- Are they in distress and might need more support?

Respond with JSON:
{
  "should_stay": true/false,
  "confidence": 0.0-1.0,
  "reason": "explanation for decision"
}`;

      const analysisHistory = [{
        role: 'user',
        parts: [{ text: stayDecisionPrompt }]
      }];

      const response = await geminiClient.generateContent(analysisHistory, null, null, 1);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[0]);
        logger.debug(`Stay decision for ${userId}: ${decision.should_stay} (${decision.confidence}) - ${decision.reason}`);
        return decision.should_stay && decision.confidence > 0.6;
      }

      // Fallback: Stay if message seems engaging
      const engagingKeywords = ['?', 'help', 'what', 'how', 'why', 'tell me', 'stressed', 'sad', 'excited', 'love'];
      return engagingKeywords.some(keyword => messageText.toLowerCase().includes(keyword));
      
    } catch (error) {
      logger.debug('Error in stay decision:', error);
      return Math.random() > 0.5; // 50% chance to stay
    }
  }

  /**
   * Schedule message to be marked as read
   */
  scheduleMessageRead(userId, messageId, delay) {
    // Clear any existing timer
    if (this.messageTimers.has(userId)) {
      clearTimeout(this.messageTimers.get(userId));
    }

    // Schedule read
    const timer = setTimeout(async () => {
      try {
        await whatsappClient.markAsRead(userId, messageId);
        logger.debug(`Marked message as read for ${userId} after ${delay}ms`);
      } catch (error) {
        logger.debug('Error marking message as read:', error);
      } finally {
        this.messageTimers.delete(userId);
      }
    }, delay);

    this.messageTimers.set(userId, timer);
  }

  /**
   * Schedule leaving the chat
   */
  scheduleLeaveChat(userId, delay) {
    // Clear any existing leave timer
    this.cancelLeaveTimer(userId);

    // Schedule leave
    const timer = setTimeout(async () => {
      try {
        await this.leaveChat(userId);
      } catch (error) {
        logger.debug('Error leaving chat:', error);
      } finally {
        this.leaveTimers.delete(userId);
      }
    }, delay);

    this.leaveTimers.set(userId, timer);
  }

  /**
   * Leave chat (stop showing as online)
   */
  async leaveChat(userId) {
    try {
      // Set presence to unavailable
      await whatsappClient.sendTyping(userId, false);
      
      // Mark chat as inactive
      if (this.activeChats.has(userId)) {
        const chatData = this.activeChats.get(userId);
        chatData.isActive = false;
        this.activeChats.set(userId, chatData);
      }

      logger.debug(`Left chat with ${userId}`);
    } catch (error) {
      logger.debug('Error leaving chat:', error);
    }
  }

  /**
   * Cancel leave timer
   */
  cancelLeaveTimer(userId) {
    if (this.leaveTimers.has(userId)) {
      clearTimeout(this.leaveTimers.get(userId));
      this.leaveTimers.delete(userId);
    }
  }

  /**
   * Get relationship context from memory
   */
  getRelationshipContext(memory) {
    try {
      const allRelationships = Object.values(memory.relationships).reduce((acc, category) => {
        return { ...acc, ...category };
      }, {});
      
      if (Object.keys(allRelationships).length > 0) {
        const relationship = Object.values(allRelationships)[0];
        return relationship.relationship || 'friend';
      }
      
      return 'new_friend';
    } catch (error) {
      return 'friend';
    }
  }

  /**
   * Get random delay between min and max milliseconds
   */
  getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * User sent a new message - reset leave timer
   */
  onUserMessage(userId) {
    // Cancel leave timer since user is still active
    this.cancelLeaveTimer(userId);
    
    // Update chat activity
    if (this.activeChats.has(userId)) {
      const chatData = this.activeChats.get(userId);
      chatData.lastMessageTime = Date.now();
      chatData.isActive = true;
      this.activeChats.set(userId, chatData);
    }
  }

  /**
   * Bot sent a response - handle post-response presence
   */
  onBotResponse(userId) {
    // The leave timer should already be set based on shouldStayInChat decision
    // This is just for logging
    const chatData = this.activeChats.get(userId);
    if (chatData && chatData.isActive) {
      logger.debug(`Bot responded to ${userId}, waiting to see if they reply...`);
    }
  }

  /**
   * Cleanup timers for a user
   */
  cleanup(userId) {
    if (this.messageTimers.has(userId)) {
      clearTimeout(this.messageTimers.get(userId));
      this.messageTimers.delete(userId);
    }
    
    if (this.leaveTimers.has(userId)) {
      clearTimeout(this.leaveTimers.get(userId));
      this.leaveTimers.delete(userId);
    }
    
    this.activeChats.delete(userId);
  }

  /**
   * Get presence status
   */
  getPresenceStatus() {
    const activeChatsCount = Array.from(this.activeChats.values()).filter(chat => chat.isActive).length;
    
    return {
      activeChats: activeChatsCount,
      totalTrackedChats: this.activeChats.size,
      pendingReadMessages: this.messageTimers.size,
      scheduledLeaves: this.leaveTimers.size
    };
  }
}

// Export singleton instance
export const chatPresenceManager = new ChatPresenceManager();