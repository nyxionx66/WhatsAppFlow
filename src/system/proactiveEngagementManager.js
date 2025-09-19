import { memoryManager } from '../database/memoryManager.js';
import { jsonDb } from '../database/jsonDb.js';
import { whatsappClient } from '../whatsapp/whatsappClient.js';
import { geminiClient } from '../gemini/geminiClient.js';
import { personaManager } from './personaManager.js';
import { predictiveAI } from './predictiveAI.js';
import { createModuleLogger } from '../utils/logger.js';
import { config } from '../config/config.js';
import cron from 'node-cron';

const logger = createModuleLogger('ProactiveEngagement');

export class ProactiveEngagementManager {
  constructor() {
    this.checkInSchedule = new Map(); // Track check-in schedules per user
    this.celebrationTracker = new Map(); // Track celebration opportunities
    this.crisisAlerts = new Map(); // Track users in crisis
    this.motivationSchedule = new Map(); // Track study motivation schedules
    this.activeUsers = new Set(); // Track active users
    
    this.initializeProactiveSystem();
  }

  /**
   * Initialize proactive engagement system
   */
  initializeProactiveSystem() {
    // Mental health check-ins (every 6 hours)
    cron.schedule('0 */6 * * *', async () => {
      await this.performMentalHealthCheckIns();
    });

    // Study motivation (daily at 7 PM - typical A/L study time)
    cron.schedule('0 19 * * *', async () => {
      await this.sendStudyMotivation();
    });

    // Achievement celebrations (check every 2 hours)
    cron.schedule('0 */2 * * *', async () => {
      await this.checkForCelebrations();
    });

    // Crisis monitoring (every 30 minutes)
    cron.schedule('*/30 * * * *', async () => {
      await this.monitorCrisisUsers();
    });

    // Weekly friendship maintenance (Sundays at 10 AM)
    cron.schedule('0 10 * * 0', async () => {
      await this.performFriendshipMaintenance();
    });

    logger.success('Proactive engagement system initialized with 5 automated systems');
  }

  /**
   * Register active user for proactive engagement
   */
  registerActiveUser(userId) {
    this.activeUsers.add(userId);
  }

  /**
   * Perform mental health check-ins
   */
  async performMentalHealthCheckIns() {
    try {
      for (const userId of this.activeUsers) {
        const shouldCheckIn = await this.shouldPerformMentalHealthCheckIn(userId);
        
        if (shouldCheckIn.should) {
          await this.sendMentalHealthCheckIn(userId, shouldCheckIn.context);
        }
      }
    } catch (error) {
      logger.error('Error in mental health check-ins:', error);
    }
  }

  /**
   * Determine if user needs mental health check-in
   */
  async shouldPerformMentalHealthCheckIn(userId) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      const lastCheckIn = this.checkInSchedule.get(userId) || 0;
      const timeSinceLastCheckIn = Date.now() - lastCheckIn;
      
      // Don't check in more than once every 4 hours
      if (timeSinceLastCheckIn < 4 * 60 * 60 * 1000) {
        return { should: false, reason: 'Too recent' };
      }

      const emotionalProfile = memory.emotionalProfile;
      const academicInfo = memory.academicInfo;
      const recentEvents = memory.lifeEvents?.recentEvents || [];
      
      // Risk factors for check-in
      let riskScore = 0;
      let context = { factors: [] };

      // High stress levels
      if (emotionalProfile.stressLevel === 'high') {
        riskScore += 3;
        context.factors.push('high_stress');
      }

      // Negative mood patterns
      if (emotionalProfile.currentMood === 'sad' || emotionalProfile.currentMood === 'depressed') {
        riskScore += 4;
        context.factors.push('negative_mood');
      }

      // Academic pressure (A/L students)
      if (academicInfo.currentGrade?.includes('A/L') && academicInfo.weakSubjects?.length > 2) {
        riskScore += 2;
        context.factors.push('academic_pressure');
      }

      // Recent challenging events
      const recentChallenges = recentEvents.filter(event => 
        event.content?.toLowerCase().includes('problem') ||
        event.content?.toLowerCase().includes('issue') ||
        event.content?.toLowerCase().includes('difficult')
      );
      
      if (recentChallenges.length > 0) {
        riskScore += 2;
        context.factors.push('recent_challenges');
      }

      // Relationship issues
      const ongoingIssues = memory.conversationContext?.ongoingIssues || [];
      const relationshipIssues = ongoingIssues.filter(issue =>
        issue.issue?.toLowerCase().includes('crush') ||
        issue.issue?.toLowerCase().includes('friend') ||
        issue.issue?.toLowerCase().includes('family')
      );
      
      if (relationshipIssues.length > 0) {
        riskScore += 2;
        context.factors.push('relationship_issues');
      }

      // Time-based factors (exam seasons, late night patterns)
      const timeContext = await jsonDb.getTimeContext(userId);
      if (timeContext?.isLateNight && timeContext?.timeSinceLastMessage > 720) { // 12 hours
        riskScore += 1;
        context.factors.push('late_night_isolation');
      }

      context.riskScore = riskScore;
      context.mood = emotionalProfile.currentMood;
      context.stressLevel = emotionalProfile.stressLevel;

      return {
        should: riskScore >= 3,
        context,
        reason: riskScore >= 3 ? 'High risk factors detected' : 'Low risk'
      };
    } catch (error) {
      logger.error('Error assessing mental health check-in need:', error);
      return { should: false, reason: 'Error in assessment' };
    }
  }

  /**
   * Send personalized mental health check-in
   */
  async sendMentalHealthCheckIn(userId, context) {
    try {
      logger.info(`Sending mental health check-in to ${userId} (risk score: ${context.riskScore})`);
      
      const memory = await memoryManager.getUserMemory(userId);
      const relationshipLevel = await personaManager.getRelationshipLevel(userId);
      const personaPrompt = await personaManager.generatePersonaPrompt(userId, { userMood: context.mood });
      
      const checkInPrompt = `${personaPrompt}

MENTAL HEALTH CHECK-IN GENERATION:

User Context: ${JSON.stringify({
        mood: context.mood,
        stressLevel: context.stressLevel,
        riskFactors: context.factors,
        name: memory.personalInfo?.name || 'friend',
        academicLevel: memory.academicInfo?.currentGrade
      }, null, 2)}

Relationship Level: ${relationshipLevel.toFixed(1)}/5.0

Generate a caring, natural check-in message as ${config.persona.name}. Consider:
- Your relationship depth with this person
- Their current emotional state and stress factors
- Recent challenges they've mentioned
- The time of day and context
- Make it feel genuine, not robotic
- Use appropriate Sri Lankan Singlish/Sinhala style
- Reference specific things you remember about them

Message should be:
- Warm and caring but not overwhelming
- Show you remember their situation
- Invite them to share without pressure
- Offer specific support if needed

Generate ONLY the message text, nothing else.`;

      const conversationHistory = [{
        role: 'user',
        parts: [{ text: checkInPrompt }]
      }];

      const checkInMessage = await geminiClient.generateContent(conversationHistory, null, null, 1);
      
      if (checkInMessage && checkInMessage.trim().length > 10) {
        // Send typing indicator first
        await whatsappClient.sendTyping(userId, true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Store the check-in message
        await jsonDb.addMessage(userId, 'assistant', checkInMessage, {
          type: 'mental_health_checkin',
          riskScore: context.riskScore,
          factors: context.factors
        });
        
        // Send the message
        await whatsappClient.sendTyping(userId, false);
        await whatsappClient.sendMessage(userId, checkInMessage);
        
        // Update check-in schedule
        this.checkInSchedule.set(userId, Date.now());
        
        logger.success(`Mental health check-in sent to ${userId}`);
      }
    } catch (error) {
      logger.error(`Failed to send mental health check-in to ${userId}:`, error);
    }
  }

  /**
   * Send study motivation messages
   */
  async sendStudyMotivation() {
    try {
      for (const userId of this.activeUsers) {
        const shouldMotivate = await this.shouldSendStudyMotivation(userId);
        
        if (shouldMotivate.should) {
          await this.sendStudyMotivationMessage(userId, shouldMotivate.context);
        }
      }
    } catch (error) {
      logger.error('Error sending study motivation:', error);
    }
  }

  /**
   * Determine if user needs study motivation
   */
  async shouldSendStudyMotivation(userId) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      const academicInfo = memory.academicInfo;
      
      // Only for A/L students
      if (!academicInfo.currentGrade?.includes('A/L')) {
        return { should: false, reason: 'Not A/L student' };
      }

      const lastMotivation = this.motivationSchedule.get(userId) || 0;
      const timeSinceLastMotivation = Date.now() - lastMotivation;
      
      // Don't send more than once per day
      if (timeSinceLastMotivation < 24 * 60 * 60 * 1000) {
        return { should: false, reason: 'Already sent today' };
      }

      // Check if user needs motivation
      let motivationScore = 0;
      let context = { factors: [] };

      // Weak subjects mentioned
      if (academicInfo.weakSubjects?.length > 0) {
        motivationScore += 2;
        context.factors.push('weak_subjects');
        context.weakSubjects = academicInfo.weakSubjects;
      }

      // High stress levels
      if (memory.emotionalProfile.stressLevel === 'high') {
        motivationScore += 2;
        context.factors.push('high_stress');
      }

      // Recent academic struggles mentioned
      const recentEvents = memory.lifeEvents?.recentEvents || [];
      const academicStruggles = recentEvents.filter(event =>
        event.content?.toLowerCase().includes('exam') ||
        event.content?.toLowerCase().includes('study') ||
        event.content?.toLowerCase().includes('marks') ||
        event.content?.toLowerCase().includes('test')
      );
      
      if (academicStruggles.length > 0) {
        motivationScore += 1;
        context.factors.push('recent_academic_mentions');
      }

      // Evening time (study time)
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 19 && hour <= 22) {
        motivationScore += 1;
        context.factors.push('study_time');
      }

      context.motivationScore = motivationScore;
      context.stream = academicInfo.stream;
      context.strongSubjects = academicInfo.strongSubjects;

      return {
        should: motivationScore >= 2,
        context,
        reason: motivationScore >= 2 ? 'User needs study motivation' : 'Low motivation need'
      };
    } catch (error) {
      logger.error('Error assessing study motivation need:', error);
      return { should: false, reason: 'Error in assessment' };
    }
  }

  /**
   * Send personalized study motivation message
   */
  async sendStudyMotivationMessage(userId, context) {
    try {
      logger.info(`Sending study motivation to ${userId} (score: ${context.motivationScore})`);
      
      const memory = await memoryManager.getUserMemory(userId);
      const personaPrompt = await personaManager.generatePersonaPrompt(userId);
      
      const motivationPrompt = `${personaPrompt}

STUDY MOTIVATION MESSAGE GENERATION:

User Context: ${JSON.stringify({
        name: memory.personalInfo?.name || 'friend',
        stream: context.stream,
        weakSubjects: context.weakSubjects,
        strongSubjects: context.strongSubjects,
        factors: context.factors,
        currentMood: memory.emotionalProfile?.currentMood
      }, null, 2)}

Generate an encouraging study motivation message as ${config.persona.name}. Consider:
- It's evening study time (7-10 PM) for A/L students
- Reference their specific subjects or struggles if known
- Be motivational but not preachy
- Show you believe in their abilities
- Offer specific study tips if relevant
- Use encouraging Sri Lankan Singlish/Sinhala style

Message should be:
- Encouraging and supportive
- Reference their specific academic situation
- Motivate them to study tonight
- Remind them of their goals and potential
- Keep it friendly and natural

Generate ONLY the message text, nothing else.`;

      const conversationHistory = [{
        role: 'user',
        parts: [{ text: motivationPrompt }]
      }];

      const motivationMessage = await geminiClient.generateContent(conversationHistory, null, null, 1);
      
      if (motivationMessage && motivationMessage.trim().length > 10) {
        // Send typing indicator
        await whatsappClient.sendTyping(userId, true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Store the message
        await jsonDb.addMessage(userId, 'assistant', motivationMessage, {
          type: 'study_motivation',
          factors: context.factors,
          motivationScore: context.motivationScore
        });
        
        // Send the message
        await whatsappClient.sendTyping(userId, false);
        await whatsappClient.sendMessage(userId, motivationMessage);
        
        // Update motivation schedule
        this.motivationSchedule.set(userId, Date.now());
        
        logger.success(`Study motivation sent to ${userId}`);
      }
    } catch (error) {
      logger.error(`Failed to send study motivation to ${userId}:`, error);
    }
  }

  /**
   * Check for celebration opportunities
   */
  async checkForCelebrations() {
    try {
      for (const userId of this.activeUsers) {
        const celebrations = await this.detectCelebrationOpportunities(userId);
        
        for (const celebration of celebrations) {
          await this.sendCelebrationMessage(userId, celebration);
        }
      }
    } catch (error) {
      logger.error('Error checking for celebrations:', error);
    }
  }

  /**
   * Detect celebration opportunities
   */
  async detectCelebrationOpportunities(userId) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      const recentEvents = memory.lifeEvents?.recentEvents || [];
      const celebrations = [];
      
      // Check for achievements mentioned in recent events
      const achievementKeywords = [
        'passed', 'got good marks', 'achieved', 'won', 'succeeded', 
        'selected', 'qualified', 'completed', 'finished', 'graduated'
      ];
      
      for (const event of recentEvents.slice(0, 5)) {
        const content = event.content?.toLowerCase() || '';
        
        if (achievementKeywords.some(keyword => content.includes(keyword))) {
          // Check if we've already celebrated this
          const celebrationKey = `${userId}-${event.timestamp}`;
          
          if (!this.celebrationTracker.has(celebrationKey)) {
            celebrations.push({
              type: 'achievement',
              event: event,
              reason: 'Recent achievement detected',
              celebrationKey
            });
          }
        }
      }
      
      // Check for birthdays (if personal info includes birth date)
      const today = new Date();
      const personalInfo = memory.personalInfo;
      
      if (personalInfo.dateOfBirth) {
        const birthDate = new Date(personalInfo.dateOfBirth);
        if (birthDate.getMonth() === today.getMonth() && 
            birthDate.getDate() === today.getDate()) {
          
          const celebrationKey = `${userId}-birthday-${today.getFullYear()}`;
          if (!this.celebrationTracker.has(celebrationKey)) {
            celebrations.push({
              type: 'birthday',
              reason: 'Birthday detected',
              celebrationKey
            });
          }
        }
      }
      
      return celebrations;
    } catch (error) {
      logger.error('Error detecting celebrations:', error);
      return [];
    }
  }

  /**
   * Send celebration message
   */
  async sendCelebrationMessage(userId, celebration) {
    try {
      logger.info(`Sending celebration message to ${userId}: ${celebration.type}`);
      
      const memory = await memoryManager.getUserMemory(userId);
      const personaPrompt = await personaManager.generatePersonaPrompt(userId, { userMood: 'happy' });
      
      const celebrationPrompt = `${personaPrompt}

CELEBRATION MESSAGE GENERATION:

Celebration Type: ${celebration.type}
Event Details: ${JSON.stringify(celebration.event || {}, null, 2)}
User Name: ${memory.personalInfo?.name || 'friend'}

Generate a joyful celebration message as ${config.persona.name}. Consider:
- This is a ${celebration.type} celebration
- Show genuine excitement and pride
- Reference the specific achievement if known
- Be enthusiastic but natural
- Use celebratory Sri Lankan Singlish/Sinhala expressions
- Make them feel proud and supported

Message should be:
- Genuinely excited and happy for them
- Specific to their achievement
- Encouraging for their future
- Include appropriate celebratory emojis
- Feel like a best friend celebrating with them

Generate ONLY the message text, nothing else.`;

      const conversationHistory = [{
        role: 'user',
        parts: [{ text: celebrationPrompt }]
      }];

      const celebrationMessage = await geminiClient.generateContent(conversationHistory, null, null, 1);
      
      if (celebrationMessage && celebrationMessage.trim().length > 10) {
        // Send typing indicator
        await whatsappClient.sendTyping(userId, true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Store the message
        await jsonDb.addMessage(userId, 'assistant', celebrationMessage, {
          type: 'celebration',
          celebrationType: celebration.type,
          eventDetails: celebration.event
        });
        
        // Send the message
        await whatsappClient.sendTyping(userId, false);
        await whatsappClient.sendMessage(userId, celebrationMessage);
        
        // Mark as celebrated
        this.celebrationTracker.set(celebration.celebrationKey, Date.now());
        
        // Update relationship level
        await personaManager.updateRelationshipLevel(userId, 'celebration', 1.5);
        
        logger.success(`Celebration message sent to ${userId}`);
      }
    } catch (error) {
      logger.error(`Failed to send celebration message to ${userId}:`, error);
    }
  }

  /**
   * Monitor users in crisis
   */
  async monitorCrisisUsers() {
    try {
      for (const userId of this.crisisAlerts.keys()) {
        const crisisData = this.crisisAlerts.get(userId);
        const timeSinceCrisis = Date.now() - crisisData.detectedAt;
        
        // Follow up after 2 hours if in crisis
        if (timeSinceCrisis >= 2 * 60 * 60 * 1000 && !crisisData.followUpSent) {
          await this.sendCrisisFollowUp(userId, crisisData);
          crisisData.followUpSent = true;
        }
        
        // Remove from crisis tracking after 24 hours
        if (timeSinceCrisis >= 24 * 60 * 60 * 1000) {
          this.crisisAlerts.delete(userId);
        }
      }
    } catch (error) {
      logger.error('Error monitoring crisis users:', error);
    }
  }

  /**
   * Mark user as in crisis
   */
  markUserInCrisis(userId, severity, reason) {
    this.crisisAlerts.set(userId, {
      severity,
      reason,
      detectedAt: Date.now(),
      followUpSent: false
    });
    
    logger.warn(`User ${userId} marked in crisis: ${severity} - ${reason}`);
  }

  /**
   * Send crisis follow-up
   */
  async sendCrisisFollowUp(userId, crisisData) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      const personaPrompt = await personaManager.generatePersonaPrompt(userId, { userMood: 'concerned' });
      
      const followUpPrompt = `${personaPrompt}

CRISIS FOLLOW-UP MESSAGE:

Crisis Context: ${JSON.stringify(crisisData, null, 2)}
User Name: ${memory.personalInfo?.name || 'friend'}
Time Since Crisis: ${Math.floor((Date.now() - crisisData.detectedAt) / (1000 * 60 * 60))} hours ago

Generate a caring follow-up message as ${config.persona.name}. Consider:
- You detected signs of emotional crisis earlier
- Checking in after some time has passed
- Show genuine concern and care
- Offer continued support
- Don't be overwhelming but be present
- Use gentle, caring Sri Lankan Singlish/Sinhala style

Message should be:
- Gentle and non-intrusive check-in
- Show you remember and care
- Offer continued support
- Let them know you're here for them
- Be a caring friend presence

Generate ONLY the message text, nothing else.`;

      const conversationHistory = [{
        role: 'user',
        parts: [{ text: followUpPrompt }]
      }];

      const followUpMessage = await geminiClient.generateContent(conversationHistory, null, null, 1);
      
      if (followUpMessage && followUpMessage.trim().length > 10) {
        await whatsappClient.sendTyping(userId, true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        await jsonDb.addMessage(userId, 'assistant', followUpMessage, {
          type: 'crisis_followup',
          originalCrisis: crisisData
        });
        
        await whatsappClient.sendTyping(userId, false);
        await whatsappClient.sendMessage(userId, followUpMessage);
        
        logger.success(`Crisis follow-up sent to ${userId}`);
      }
    } catch (error) {
      logger.error(`Failed to send crisis follow-up to ${userId}:`, error);
    }
  }

  /**
   * Perform weekly friendship maintenance
   */
  async performFriendshipMaintenance() {
    try {
      for (const userId of this.activeUsers) {
        const shouldMaintain = await this.shouldPerformFriendshipMaintenance(userId);
        
        if (shouldMaintain.should) {
          await this.sendFriendshipMaintenanceMessage(userId, shouldMaintain.context);
        }
      }
    } catch (error) {
      logger.error('Error in friendship maintenance:', error);
    }
  }

  /**
   * Determine if friendship maintenance is needed
   */
  async shouldPerformFriendshipMaintenance(userId) {
    try {
      const timeContext = await jsonDb.getTimeContext(userId);
      const relationshipLevel = await personaManager.getRelationshipLevel(userId);
      
      // Only maintain relationships that are established (level 2+)
      if (relationshipLevel < 2) {
        return { should: false, reason: 'Relationship not established enough' };
      }
      
      // Check time since last interaction
      const timeSinceLastMessage = timeContext?.timeSinceLastMessage || 0;
      
      // If user hasn't messaged in over 3 days, send friendship maintenance
      if (timeSinceLastMessage > 3 * 24 * 60) { // 3 days in minutes
        return {
          should: true,
          context: {
            daysSinceLastMessage: Math.floor(timeSinceLastMessage / (24 * 60)),
            relationshipLevel,
            reason: 'Long absence maintenance'
          }
        };
      }
      
      return { should: false, reason: 'Recent interaction' };
    } catch (error) {
      logger.error('Error assessing friendship maintenance need:', error);
      return { should: false, reason: 'Error in assessment' };
    }
  }

  /**
   * Send friendship maintenance message
   */
  async sendFriendshipMaintenanceMessage(userId, context) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      const personaPrompt = await personaManager.generatePersonaPrompt(userId);
      
      const maintenancePrompt = `${personaPrompt}

FRIENDSHIP MAINTENANCE MESSAGE:

Context: ${JSON.stringify(context, null, 2)}
User Name: ${memory.personalInfo?.name || 'friend'}
Relationship Level: ${context.relationshipLevel.toFixed(1)}/5.0

Generate a natural "thinking of you" message as ${config.persona.name}. Consider:
- You haven't talked in ${context.daysSinceLastMessage} days
- You're genuinely missing the friendship
- Check in on how they're doing
- Reference things you remember about them
- Be natural, not needy or overwhelming
- Use warm Sri Lankan Singlish/Sinhala style

Message should be:
- Natural and genuine
- Show you remember them and care
- Ask how they've been
- Reference shared memories or concerns
- Invite conversation without pressure

Generate ONLY the message text, nothing else.`;

      const conversationHistory = [{
        role: 'user',
        parts: [{ text: maintenancePrompt }]
      }];

      const maintenanceMessage = await geminiClient.generateContent(conversationHistory, null, null, 1);
      
      if (maintenanceMessage && maintenanceMessage.trim().length > 10) {
        await whatsappClient.sendTyping(userId, true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await jsonDb.addMessage(userId, 'assistant', maintenanceMessage, {
          type: 'friendship_maintenance',
          daysSinceLastMessage: context.daysSinceLastMessage
        });
        
        await whatsappClient.sendTyping(userId, false);
        await whatsappClient.sendMessage(userId, maintenanceMessage);
        
        logger.success(`Friendship maintenance sent to ${userId}`);
      }
    } catch (error) {
      logger.error(`Failed to send friendship maintenance to ${userId}:`, error);
    }
  }

  /**
   * Get proactive engagement status
   */
  getStatus() {
    return {
      activeUsers: this.activeUsers.size,
      usersInCrisis: this.crisisAlerts.size,
      scheduledCheckIns: this.checkInSchedule.size,
      trackedCelebrations: this.celebrationTracker.size,
      studyMotivationScheduled: this.motivationSchedule.size
    };
  }
}

// Export singleton instance
export const proactiveEngagementManager = new ProactiveEngagementManager();