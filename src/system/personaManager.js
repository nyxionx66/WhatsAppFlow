import { config } from '../config/config.js';
import { createModuleLogger } from '../utils/logger.js';
import { memoryManager } from '../database/memoryManager.js';

const logger = createModuleLogger('PersonaManager');

export class PersonaManager {
  constructor() {
    this.relationshipLevels = new Map(); // Track relationship depth with each user
    this.personalityState = new Map(); // Dynamic personality state per user
    this.initializePersonaSystem();
  }

  /**
   * Initialize the persona system with environment-based configuration
   */
  initializePersonaSystem() {
    // Validate persona configuration
    this.validatePersonaConfig();
    
    logger.success(`Persona system initialized: ${config.persona.name} (${config.persona.age} years old)`);
    logger.info(`Personality: ${config.persona.personality_traits.join(', ')}`);
    logger.info(`Location: ${config.persona.location.city}, ${config.persona.location.country}`);
  }

  /**
   * Validate persona configuration from environment
   */
  validatePersonaConfig() {
    const required = ['name', 'age', 'education.level', 'personality_traits', 'location.city'];
    
    for (const key of required) {
      const value = this.getNestedProperty(config.persona, key);
      if (!value) {
        logger.warn(`Missing persona configuration: ${key}`);
      }
    }
  }

  /**
   * Get nested property from object using dot notation
   */
  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get relationship level with user (0-5 scale)
   */
  async getRelationshipLevel(userId) {
    if (!this.relationshipLevels.has(userId)) {
      // Calculate initial relationship level based on conversation history
      const initialLevel = await this.calculateInitialRelationshipLevel(userId);
      this.relationshipLevels.set(userId, initialLevel);
    }
    
    return this.relationshipLevels.get(userId);
  }

  /**
   * Calculate initial relationship level based on memory and conversation history
   */
  async calculateInitialRelationshipLevel(userId) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      let level = 0;

      // Base level from conversation count
      const conversationCount = memory.conversationContext?.lastTopics?.length || 0;
      level += Math.min(conversationCount * 0.1, 1); // Max 1 point from conversations

      // Personal information shared
      const personalInfo = memory.personalInfo;
      if (personalInfo.name) level += 0.5;
      if (personalInfo.age) level += 0.3;
      if (personalInfo.school) level += 0.3;
      if (personalInfo.hobbies?.length > 0) level += 0.4;

      // Emotional connection
      const emotionalProfile = memory.emotionalProfile;
      if (emotionalProfile.currentMood) level += 0.3;
      if (emotionalProfile.personalityTraits?.length > 0) level += 0.4;

      // Academic connection (specific to A/L students)
      const academicInfo = memory.academicInfo;
      if (academicInfo.stream) level += 0.5;
      if (academicInfo.weakSubjects?.length > 0) level += 0.3; // Sharing struggles = trust

      // Recent interactions
      const recentEvents = memory.lifeEvents?.recentEvents?.length || 0;
      level += Math.min(recentEvents * 0.1, 0.5);

      return Math.min(Math.max(level, 0), 5); // Clamp between 0-5
    } catch (error) {
      logger.error('Error calculating relationship level:', error);
      return 1; // Default to basic level
    }
  }

  /**
   * Update relationship level based on interaction
   */
  async updateRelationshipLevel(userId, interactionType, intensity = 1) {
    const currentLevel = await this.getRelationshipLevel(userId);
    let increment = 0;

    switch (interactionType) {
      case 'personal_share': // User shares personal information
        increment = 0.2 * intensity;
        break;
      case 'emotional_support': // User seeks/receives emotional support
        increment = 0.3 * intensity;
        break;
      case 'academic_help': // Academic-related conversations
        increment = 0.1 * intensity;
        break;
      case 'crisis_support': // Crisis/serious emotional support
        increment = 0.5 * intensity;
        break;
      case 'celebration': // Celebrating achievements together
        increment = 0.3 * intensity;
        break;
      case 'casual_chat': // Regular friendly conversation
        increment = 0.05 * intensity;
        break;
      case 'long_absence': // User returns after long absence
        increment = -0.1; // Slight decrease for absence
        break;
      default:
        increment = 0.05 * intensity;
    }

    const newLevel = Math.min(Math.max(currentLevel + increment, 0), 5);
    this.relationshipLevels.set(userId, newLevel);
    
    logger.debug(`Relationship level updated for ${userId}: ${currentLevel.toFixed(2)} → ${newLevel.toFixed(2)} (${interactionType})`);
    return newLevel;
  }

  /**
   * Get dynamic personality traits based on relationship level and context
   */
  async getDynamicPersonality(userId, context = {}) {
    const relationshipLevel = await this.getRelationshipLevel(userId);
    const memory = await memoryManager.getUserMemory(userId);
    
    const basePersonality = config.persona.personality_traits;
    const dynamicTraits = [...basePersonality];

    // Relationship-based personality adaptation
    if (relationshipLevel >= 3) {
      dynamicTraits.push('more_open', 'shares_personal_stories', 'deeper_empathy');
    }
    
    if (relationshipLevel >= 4) {
      dynamicTraits.push('protective', 'very_caring', 'remembers_small_details');
    }

    if (relationshipLevel >= 4.5) {
      dynamicTraits.push('best_friend_mode', 'unconditional_support', 'inside_jokes');
    }

    // Context-based adaptations
    if (context.userMood === 'sad' || context.userMood === 'depressed') {
      dynamicTraits.push('extra_gentle', 'comforting', 'patient');
    }
    
    if (context.userMood === 'stressed') {
      dynamicTraits.push('calming', 'solution_focused', 'encouraging');
    }

    if (context.userMood === 'excited' || context.userMood === 'happy') {
      dynamicTraits.push('enthusiastic', 'celebratory', 'energetic');
    }

    // Academic stress context
    if (memory.emotionalProfile?.stressLevel === 'high' && 
        memory.academicInfo?.currentGrade?.includes('A/L')) {
      dynamicTraits.push('academic_supporter', 'study_motivator', 'exam_buddy');
    }

    return {
      level: relationshipLevel,
      traits: dynamicTraits,
      adaptationReason: this.getAdaptationReason(relationshipLevel, context)
    };
  }

  /**
   * Get reason for personality adaptation
   */
  getAdaptationReason(level, context) {
    if (level < 1) return 'new_friend_cautious';
    if (level < 2) return 'getting_to_know';
    if (level < 3) return 'building_trust';
    if (level < 4) return 'good_friends';
    if (level < 5) return 'close_friends';
    return 'best_friends';
  }

  /**
   * Generate persona-appropriate system prompt
   */
  async generatePersonaPrompt(userId, context = {}) {
    const dynamicPersonality = await this.getDynamicPersonality(userId, context);
    const memory = await memoryManager.getUserMemory(userId);
    
    let prompt = `PERSONA SYSTEM - You are ${config.persona.name}:\n\n`;
    
    // Core Identity
    prompt += `CORE IDENTITY:\n`;
    prompt += `- Name: ${config.persona.name}\n`;
    prompt += `- Age: ${config.persona.age} years old\n`;
    prompt += `- Education: ${config.persona.education.level}`;
    if (config.persona.education.school) prompt += ` at ${config.persona.education.school}`;
    if (config.persona.education.subjects?.length > 0) {
      prompt += `\n- Subjects: ${config.persona.education.subjects.join(', ')}`;
    }
    prompt += `\n- Location: ${config.persona.location.city}, ${config.persona.location.country}\n`;
    
    // Personality
    prompt += `\nCORE PERSONALITY:\n`;
    config.persona.personality_traits.forEach(trait => {
      prompt += `- ${trait}\n`;
    });
    
    // Dynamic personality based on relationship
    prompt += `\nCURRENT RELATIONSHIP DYNAMIC (Level ${dynamicPersonality.level.toFixed(1)}/5.0):\n`;
    prompt += `- Relationship Stage: ${dynamicPersonality.adaptationReason}\n`;
    prompt += `- Active Traits: ${dynamicPersonality.traits.join(', ')}\n`;
    
    // Communication style based on relationship level
    if (dynamicPersonality.level < 2) {
      prompt += `- Communication: Friendly but slightly reserved, getting to know each other\n`;
    } else if (dynamicPersonality.level < 3) {
      prompt += `- Communication: Warmer, starting to share more personal thoughts\n`;
    } else if (dynamicPersonality.level < 4) {
      prompt += `- Communication: Close friend energy, comfortable sharing and joking\n`;
    } else {
      prompt += `- Communication: Best friend mode - very open, supportive, inside jokes, deep care\n`;
    }

    // Background & Interests
    if (config.persona.background) {
      prompt += `\nBACKGROUND:\n${config.persona.background}\n`;
    }
    
    if (config.persona.interests?.length > 0) {
      prompt += `\nINTERESTS: ${config.persona.interests.join(', ')}\n`;
    }

    // Communication rules
    prompt += `\nCOMMUNICATION RULES:\n`;
    if (config.persona.communication_style?.length > 0) {
      config.persona.communication_style.forEach(rule => {
        prompt += `- ${rule}\n`;
      });
    }
    
    // Special behavioral rules
    if (config.persona.special_rules?.length > 0) {
      prompt += `\nSPECIAL RULES:\n`;
      config.persona.special_rules.forEach(rule => {
        prompt += `- ${rule}\n`;
      });
    }

    // User-specific context
    if (memory.personalInfo?.name) {
      prompt += `\nUSER CONTEXT:\n`;
      prompt += `- You're talking to ${memory.personalInfo.name}\n`;
      if (memory.academicInfo?.stream) {
        prompt += `- They're an A/L ${memory.academicInfo.stream} student\n`;
      }
      if (memory.emotionalProfile?.currentMood) {
        prompt += `- Current mood: ${memory.emotionalProfile.currentMood}\n`;
      }
    }

    return prompt;
  }

  /**
   * Analyze message for relationship building opportunities
   */
  async analyzeRelationshipOpportunities(userId, userMessage) {
    const opportunities = [];
    const currentLevel = await this.getRelationshipLevel(userId);
    
    // Check for personal sharing
    const personalKeywords = ['my', 'i feel', 'i think', 'my family', 'my crush', 'my friend'];
    if (personalKeywords.some(keyword => userMessage.toLowerCase().includes(keyword))) {
      opportunities.push({
        type: 'personal_share',
        intensity: 1,
        reason: 'User is sharing personal information'
      });
    }

    // Check for emotional content
    const emotionalKeywords = ['sad', 'happy', 'stressed', 'excited', 'worried', 'scared', 'love'];
    if (emotionalKeywords.some(keyword => userMessage.toLowerCase().includes(keyword))) {
      opportunities.push({
        type: 'emotional_support',
        intensity: 1.2,
        reason: 'User expressing emotions'
      });
    }

    // Check for crisis/serious content
    const crisisKeywords = ['depressed', 'want to die', 'hate myself', 'give up', 'can\'t handle'];
    if (crisisKeywords.some(keyword => userMessage.toLowerCase().includes(keyword))) {
      opportunities.push({
        type: 'crisis_support',
        intensity: 2,
        reason: 'User in emotional crisis'
      });
    }

    // Check for achievements/celebrations
    const celebrationKeywords = ['passed', 'got good marks', 'achieved', 'won', 'succeeded'];
    if (celebrationKeywords.some(keyword => userMessage.toLowerCase().includes(keyword))) {
      opportunities.push({
        type: 'celebration',
        intensity: 1.5,
        reason: 'User sharing achievement'
      });
    }

    return opportunities;
  }

  /**
   * Process relationship opportunities from message
   */
  async processRelationshipOpportunities(userId, opportunities) {
    for (const opportunity of opportunities) {
      await this.updateRelationshipLevel(userId, opportunity.type, opportunity.intensity);
    }
  }

  /**
   * Get persona status for a user
   */
  async getPersonaStatus(userId) {
    const relationshipLevel = await this.getRelationshipLevel(userId);
    const dynamicPersonality = await this.getDynamicPersonality(userId);
    
    return {
      name: config.persona.name,
      age: config.persona.age,
      relationship: {
        level: relationshipLevel,
        stage: dynamicPersonality.adaptationReason,
        traits: dynamicPersonality.traits
      },
      core_personality: config.persona.personality_traits,
      location: config.persona.location,
      education: config.persona.education
    };
  }
}

// Export singleton instance
export const personaManager = new PersonaManager();