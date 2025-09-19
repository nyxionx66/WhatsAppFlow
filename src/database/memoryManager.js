import { FileUtils } from '../utils/fileUtils.js';
import { config } from '../config/config.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('MemoryManager');

export class MemoryManager {
  constructor() {
    this.memoryFile = 'data/user_memories.json';
    this.lockMap = new Map(); // Simple in-memory lock for concurrent operations
  }

  /**
   * Get a lock for a specific user to prevent concurrent modifications
   */
  async acquireLock(userId) {
    while (this.lockMap.has(userId)) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.lockMap.set(userId, true);
  }

  /**
   * Release lock for a user
   */
  releaseLock(userId) {
    this.lockMap.delete(userId);
  }

  /**
   * Read all user memories from JSON file
   */
  async readMemories() {
    try {
      const data = await FileUtils.readJsonFile(this.memoryFile, {});
      return data;
    } catch (error) {
      logger.error('Failed to read memories:', error);
      return {};
    }
  }

  /**
   * Write all user memories to JSON file
   */
  async writeMemories(data) {
    try {
      await FileUtils.writeJsonFile(this.memoryFile, data);
    } catch (error) {
      logger.error('Failed to write memories:', error);
      throw error;
    }
  }

  /**
   * Get user's memory profile
   */
  async getUserMemory(userId) {
    try {
      const memories = await this.readMemories();
      return memories[userId] || this.createEmptyMemoryProfile();
    } catch (error) {
      logger.error(`Failed to get memory for ${userId}:`, error);
      return this.createEmptyMemoryProfile();
    }
  }

  /**
   * Create empty memory profile structure
   */
  createEmptyMemoryProfile() {
    return {
      personalInfo: {
        name: null,
        age: null,
        school: null,
        grade: null,
        subjects: [],
        hobbies: [],
        family: {},
        location: null
      },
      relationships: {
        friends: {},
        crushes: {},
        family: {},
        teachers: {}
      },
      preferences: {
        favoriteSubjects: [],
        dislikedSubjects: [],
        favoriteFood: [],
        favoriteMovies: [],
        favoriteMusic: [],
        favoriteColors: []
      },
      emotionalProfile: {
        currentMood: null,
        stressLevel: 'normal',
        personalityTraits: [],
        emotionalPatterns: [],
        supportNeeds: []
      },
      academicInfo: {
        stream: null,
        currentGrade: null,
        strongSubjects: [],
        weakSubjects: [],
        examSchedule: {},
        studyHabits: [],
        academicGoals: []
      },
      lifeEvents: {
        importantDates: {},
        achievements: [],
        challenges: [],
        goals: [],
        recentEvents: []
      },
      conversationContext: {
        lastTopics: [],
        ongoingIssues: [],
        promisesToKeep: [],
        thingsToRemember: [],
        lastInteraction: null
      },
      contacts: {},
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Update specific memory category for a user
   */
  async updateMemory(userId, category, data, merge = true) {
    await this.acquireLock(userId);
    
    try {
      const memories = await this.readMemories();
      
      if (!memories[userId]) {
        memories[userId] = this.createEmptyMemoryProfile();
      }

      if (merge && typeof memories[userId][category] === 'object' && !Array.isArray(memories[userId][category])) {
        memories[userId][category] = { ...memories[userId][category], ...data };
      } else {
        memories[userId][category] = data;
      }

      memories[userId].lastUpdated = new Date().toISOString();
      
      await this.writeMemories(memories);
      logger.debug(`Memory updated for ${userId}: ${category}`);
      
      return memories[userId];
    } catch (error) {
      logger.error(`Failed to update memory for ${userId}:`, error);
      throw error;
    } finally {
      this.releaseLock(userId);
    }
  }

  /**
   * Add to array-based memory categories
   */
  async addToMemoryArray(userId, category, subcategory, item, maxItems = 20) {
    await this.acquireLock(userId);
    
    try {
      const memories = await this.readMemories();
      
      if (!memories[userId]) {
        memories[userId] = this.createEmptyMemoryProfile();
      }

      if (!memories[userId][category]) {
        memories[userId][category] = {};
      }

      if (!Array.isArray(memories[userId][category][subcategory])) {
        memories[userId][category][subcategory] = [];
      }

      // Add timestamp to item if it's an object
      const itemWithTimestamp = typeof item === 'object' ? 
        { ...item, timestamp: new Date().toISOString() } : 
        { content: item, timestamp: new Date().toISOString() };

      memories[userId][category][subcategory].unshift(itemWithTimestamp);

      // Keep only the most recent items
      if (memories[userId][category][subcategory].length > maxItems) {
        memories[userId][category][subcategory] = memories[userId][category][subcategory].slice(0, maxItems);
      }

      memories[userId].lastUpdated = new Date().toISOString();
      
      await this.writeMemories(memories);
      logger.debug(`Added to memory array for ${userId}: ${category}.${subcategory}`);
      
      return memories[userId];
    } catch (error) {
      logger.error(`Failed to add to memory array for ${userId}:`, error);
      throw error;
    } finally {
      this.releaseLock(userId);
    }
  }

  /**
   * Store personal information
   */
  async storePersonalInfo(userId, info) {
    return await this.updateMemory(userId, 'personalInfo', info, true);
  }

  /**
   * Store relationship information
   */
  async storeRelationship(userId, type, name, details) {
    const memories = await this.getUserMemory(userId);
    
    if (!memories.relationships[type]) {
      memories.relationships[type] = {};
    }
    
    memories.relationships[type][name.toLowerCase()] = {
      name,
      ...details,
      lastMentioned: new Date().toISOString()
    };
    
    return await this.updateMemory(userId, 'relationships', memories.relationships);
  }

  /**
   * Store academic information
   */
  async storeAcademicInfo(userId, info) {
    return await this.updateMemory(userId, 'academicInfo', info, true);
  }

  /**
   * Store emotional context
   */
  async storeEmotionalContext(userId, context) {
    const emotionalData = {
      currentMood: context.mood || null,
      stressLevel: context.stressLevel || 'normal',
      lastEmotionalUpdate: new Date().toISOString()
    };

    if (context.traits) {
      emotionalData.personalityTraits = context.traits;
    }

    return await this.updateMemory(userId, 'emotionalProfile', emotionalData, true);
  }

  /**
   * Store life event
   */
  async storeLifeEvent(userId, event) {
    return await this.addToMemoryArray(userId, 'lifeEvents', 'recentEvents', event, 15);
  }

  /**
   * Store conversation context
   */
  async storeConversationContext(userId, context) {
    const memories = await this.getUserMemory(userId);
    
    // Update last topics
    if (context.topic) {
      if (!memories.conversationContext.lastTopics) {
        memories.conversationContext.lastTopics = [];
      }
      memories.conversationContext.lastTopics.unshift({
        topic: context.topic,
        timestamp: new Date().toISOString()
      });
      memories.conversationContext.lastTopics = memories.conversationContext.lastTopics.slice(0, 10);
    }

    // Update ongoing issues
    if (context.issue) {
      if (!memories.conversationContext.ongoingIssues) {
        memories.conversationContext.ongoingIssues = [];
      }
      memories.conversationContext.ongoingIssues.unshift({
        issue: context.issue,
        status: context.status || 'ongoing',
        timestamp: new Date().toISOString()
      });
    }

    // Update things to remember
    if (context.remember) {
      if (!memories.conversationContext.thingsToRemember) {
        memories.conversationContext.thingsToRemember = [];
      }
      memories.conversationContext.thingsToRemember.unshift({
        content: context.remember,
        importance: context.importance || 'medium',
        timestamp: new Date().toISOString()
      });
      memories.conversationContext.thingsToRemember = memories.conversationContext.thingsToRemember.slice(0, 20);
    }

    memories.conversationContext.lastInteraction = new Date().toISOString();
    
    return await this.updateMemory(userId, 'conversationContext', memories.conversationContext);
  }

  /**
   * Get memory summary for AI context
   */
  async getMemorySummary(userId) {
    try {
      const memory = await this.getUserMemory(userId);
      
      let summary = "=== USER MEMORY PROFILE ===\n\n";
      
      // Personal Info
      if (memory.personalInfo.name || memory.personalInfo.age || memory.personalInfo.school) {
        summary += "PERSONAL INFO:\n";
        if (memory.personalInfo.name) summary += `- Name: ${memory.personalInfo.name}\n`;
        if (memory.personalInfo.age) summary += `- Age: ${memory.personalInfo.age}\n`;
        if (memory.personalInfo.school) summary += `- School: ${memory.personalInfo.school}\n`;
        if (memory.personalInfo.grade) summary += `- Grade: ${memory.personalInfo.grade}\n`;
        if (memory.personalInfo.subjects.length > 0) summary += `- Subjects: ${memory.personalInfo.subjects.join(', ')}\n`;
        if (memory.personalInfo.hobbies.length > 0) summary += `- Hobbies: ${memory.personalInfo.hobbies.join(', ')}\n`;
        summary += "\n";
      }

      // Academic Info
      if (memory.academicInfo.stream || memory.academicInfo.strongSubjects.length > 0) {
        summary += "ACADEMIC INFO:\n";
        if (memory.academicInfo.stream) summary += `- Stream: ${memory.academicInfo.stream}\n`;
        if (memory.academicInfo.currentGrade) summary += `- Current Grade: ${memory.academicInfo.currentGrade}\n`;
        if (memory.academicInfo.strongSubjects.length > 0) summary += `- Strong Subjects: ${memory.academicInfo.strongSubjects.join(', ')}\n`;
        if (memory.academicInfo.weakSubjects.length > 0) summary += `- Weak Subjects: ${memory.academicInfo.weakSubjects.join(', ')}\n`;
        summary += "\n";
      }

      // Relationships
      const allRelationships = Object.values(memory.relationships).reduce((acc, category) => {
        return { ...acc, ...category };
      }, {});
      
      if (Object.keys(allRelationships).length > 0) {
        summary += "RELATIONSHIPS:\n";
        Object.values(allRelationships).forEach(person => {
          summary += `- ${person.name}: ${person.relationship || 'friend'}\n`;
        });
        summary += "\n";
      }

      // Emotional Profile
      if (memory.emotionalProfile.currentMood || memory.emotionalProfile.stressLevel !== 'normal') {
        summary += "EMOTIONAL STATE:\n";
        if (memory.emotionalProfile.currentMood) summary += `- Current Mood: ${memory.emotionalProfile.currentMood}\n`;
        if (memory.emotionalProfile.stressLevel !== 'normal') summary += `- Stress Level: ${memory.emotionalProfile.stressLevel}\n`;
        if (memory.emotionalProfile.personalityTraits.length > 0) summary += `- Personality: ${memory.emotionalProfile.personalityTraits.join(', ')}\n`;
        summary += "\n";
      }

      // Recent Events
      if (memory.lifeEvents.recentEvents && memory.lifeEvents.recentEvents.length > 0) {
        summary += "RECENT EVENTS:\n";
        memory.lifeEvents.recentEvents.slice(0, 5).forEach(event => {
          const content = typeof event === 'object' ? event.content : event;
          summary += `- ${content}\n`;
        });
        summary += "\n";
      }

      // Conversation Context
      if (memory.conversationContext.ongoingIssues && memory.conversationContext.ongoingIssues.length > 0) {
        summary += "ONGOING ISSUES:\n";
        memory.conversationContext.ongoingIssues.slice(0, 3).forEach(issue => {
          summary += `- ${issue.issue} (${issue.status})\n`;
        });
        summary += "\n";
      }

      // Things to Remember
      if (memory.conversationContext.thingsToRemember && memory.conversationContext.thingsToRemember.length > 0) {
        summary += "IMPORTANT TO REMEMBER:\n";
        memory.conversationContext.thingsToRemember.slice(0, 5).forEach(item => {
          summary += `- ${item.content}\n`;
        });
        summary += "\n";
      }

      return summary;
    } catch (error) {
      logger.error(`Failed to get memory summary for ${userId}:`, error);
      return "=== USER MEMORY PROFILE ===\n\nNo memory data available.\n\n";
    }
  }

  /**
   * Clear all memories for a user
   */
  async clearUserMemory(userId) {
    await this.acquireLock(userId);
    
    try {
      const memories = await this.readMemories();
      delete memories[userId];
      await this.writeMemories(memories);
      logger.info(`All memories cleared for ${userId}`);
    } catch (error) {
      logger.error(`Failed to clear memories for ${userId}:`, error);
      throw error;
    } finally {
      this.releaseLock(userId);
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats() {
    try {
      const memories = await this.readMemories();
      const users = Object.keys(memories);
      
      let totalMemories = 0;
      users.forEach(userId => {
        const userMemory = memories[userId];
        // Count non-empty memory categories
        Object.values(userMemory).forEach(category => {
          if (typeof category === 'object' && category !== null) {
            totalMemories += Object.keys(category).length;
          }
        });
      });

      return {
        totalUsers: users.length,
        totalMemories,
        averageMemoriesPerUser: users.length > 0 ? Math.round(totalMemories / users.length) : 0
      };
    } catch (error) {
      logger.error('Failed to get memory stats:', error);
      return { totalUsers: 0, totalMemories: 0, averageMemoriesPerUser: 0 };
    }
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();