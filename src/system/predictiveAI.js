import { memoryManager } from '../database/memoryManager.js';
import { jsonDb } from '../database/jsonDb.js';
import { geminiClient } from '../gemini/geminiClient.js';
import { personaManager } from './personaManager.js';
import { proactiveEngagementManager } from './proactiveEngagementManager.js';
import { createModuleLogger } from '../utils/logger.js';
import { config } from '../config/config.js';
import cron from 'node-cron';

const logger = createModuleLogger('PredictiveAI');

export class PredictiveAI {
  constructor() {
    this.moodPredictions = new Map(); // Track mood prediction history
    this.academicRiskAssessments = new Map(); // Track academic risk scores
    this.studyTimeOptimization = new Map(); // Track optimal study patterns
    this.socialSupportPredictions = new Map(); // Track social support needs
    this.predictionAccuracy = new Map(); // Track prediction accuracy
    
    this.initializePredictiveSystem();
  }

  /**
   * Initialize predictive AI system
   */
  initializePredictiveSystem() {
    // Daily predictive analysis (every morning at 8 AM)
    cron.schedule('0 8 * * *', async () => {
      await this.performDailyPredictiveAnalysis();
    });

    // Mood prediction updates (every 4 hours)
    cron.schedule('0 */4 * * *', async () => {
      await this.updateMoodPredictions();
    });

    // Academic risk assessment (weekly on Mondays at 9 AM)
    cron.schedule('0 9 * * 1', async () => {
      await this.performAcademicRiskAssessment();
    });

    // Study optimization analysis (daily at 6 PM)
    cron.schedule('0 18 * * *', async () => {
      await this.optimizeStudyRecommendations();
    });

    logger.success('Predictive AI system initialized with 4 analysis engines');
  }

  /**
   * Perform daily predictive analysis for all active users
   */
  async performDailyPredictiveAnalysis() {
    try {
      const activeUsers = await this.getActiveUsers();
      
      for (const userId of activeUsers) {
        // Parallel predictions for efficiency
        await Promise.all([
          this.predictUserMood(userId),
          this.assessAcademicRisk(userId),
          this.predictSocialSupportNeeds(userId),
          this.optimizeStudyTiming(userId)
        ]);
      }
      
      logger.success(`Daily predictive analysis completed for ${activeUsers.length} users`);
    } catch (error) {
      logger.error('Error in daily predictive analysis:', error);
    }
  }

  /**
   * Get list of active users (users who've messaged in last 7 days)
   */
  async getActiveUsers() {
    try {
      // This would ideally come from the database
      // For now, we'll use proactive engagement manager's active users
      return Array.from(proactiveEngagementManager.activeUsers);
    } catch (error) {
      logger.error('Error getting active users:', error);
      return [];
    }
  }

  /**
   * Predict user's mood based on conversation patterns and history
   */
  async predictUserMood(userId, timeHorizon = 24) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      const conversationHistory = await jsonDb.getMessagesForSender(userId);
      const timeContext = await jsonDb.getTimeContext(userId);
      
      const predictionPrompt = `MOOD PREDICTION ANALYSIS:

User Memory Profile: ${JSON.stringify({
        currentMood: memory.emotionalProfile?.currentMood,
        stressLevel: memory.emotionalProfile?.stressLevel,
        personalityTraits: memory.emotionalProfile?.personalityTraits,
        emotionalPatterns: memory.emotionalProfile?.emotionalPatterns,
        academicPressure: memory.academicInfo?.weakSubjects?.length || 0,
        recentEvents: memory.lifeEvents?.recentEvents?.slice(0, 3) || [],
        ongoingIssues: memory.conversationContext?.ongoingIssues?.slice(0, 3) || []
      }, null, 2)}

Recent Conversation Patterns: ${JSON.stringify(
        conversationHistory.slice(-10).map(msg => ({
          role: msg.role,
          timestamp: msg.timestamp,
          timeOfDay: msg.timeOfDay,
          content: msg.content.substring(0, 100) + '...'
        })), null, 2
      )}

Time Context: ${JSON.stringify(timeContext, null, 2)}

Prediction Timeframe: Next ${timeHorizon} hours

ANALYZE and PREDICT the user's likely mood progression over the next ${timeHorizon} hours.

Consider:
- Current emotional state and stress levels
- Academic pressure patterns (A/L student context)
- Recent life events and ongoing issues
- Time-based patterns (sleep, study, social time)
- Conversation sentiment trends
- Upcoming challenges or positive events

Respond with JSON:
{
  "current_mood_assessment": {
    "mood": "happy|sad|stressed|anxious|excited|neutral|angry|depressed",
    "confidence": 0.0-1.0,
    "reasoning": "why this mood assessment"
  },
  "mood_prediction": {
    "predicted_mood_4h": "mood in 4 hours",
    "predicted_mood_12h": "mood in 12 hours", 
    "predicted_mood_24h": "mood in 24 hours",
    "confidence": 0.0-1.0,
    "key_factors": ["factor1", "factor2", "factor3"]
  },
  "risk_factors": {
    "mood_deterioration_risk": 0.0-1.0,
    "stress_spike_probability": 0.0-1.0,
    "social_support_need": 0.0-1.0,
    "academic_pressure_impact": 0.0-1.0
  },
  "intervention_recommendations": [
    {
      "timing": "immediate|4h|12h|24h",
      "type": "check_in|motivation|celebration|crisis_support",
      "reason": "why this intervention is recommended",
      "priority": "high|medium|low"
    }
  ]
}`;

      const analysisHistory = [{
        role: 'user',
        parts: [{ text: predictionPrompt }]
      }];

      const response = await geminiClient.generateContent(analysisHistory, null, null, 1);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const prediction = JSON.parse(jsonMatch[0]);
        
        // Store prediction
        this.moodPredictions.set(userId, {
          prediction,
          timestamp: Date.now(),
          timeHorizon
        });
        
        // Process high-priority interventions
        await this.processInterventionRecommendations(userId, prediction.intervention_recommendations);
        
        logger.debug(`Mood prediction completed for ${userId}: ${prediction.mood_prediction.predicted_mood_24h}`);
        return prediction;
      }
      
      return null;
    } catch (error) {
      logger.error(`Error predicting mood for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Assess academic risk for A/L students
   */
  async assessAcademicRisk(userId) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      const academicInfo = memory.academicInfo;
      
      // Only assess A/L students
      if (!academicInfo.currentGrade?.includes('A/L')) {
        return null;
      }

      const riskPrompt = `ACADEMIC RISK ASSESSMENT:

Student Profile: ${JSON.stringify({
        stream: academicInfo.stream,
        currentGrade: academicInfo.currentGrade,
        strongSubjects: academicInfo.strongSubjects,
        weakSubjects: academicInfo.weakSubjects,
        studyHabits: academicInfo.studyHabits,
        academicGoals: academicInfo.academicGoals,
        examSchedule: academicInfo.examSchedule
      }, null, 2)}

Emotional Context: ${JSON.stringify({
        stressLevel: memory.emotionalProfile?.stressLevel,
        currentMood: memory.emotionalProfile?.currentMood,
        supportNeeds: memory.emotionalProfile?.supportNeeds
      }, null, 2)}

Recent Academic Events: ${JSON.stringify(
        (memory.lifeEvents?.recentEvents || [])
          .filter(event => event.content?.toLowerCase().includes('exam') ||
                          event.content?.toLowerCase().includes('study') ||
                          event.content?.toLowerCase().includes('marks'))
          .slice(0, 3), null, 2
      )}

ANALYZE academic risk factors and provide comprehensive assessment.

Consider:
- Subject weakness patterns and impact on overall performance
- Study habit effectiveness and consistency
- Emotional stress impact on academic performance
- Time management and preparation levels
- Goal alignment and realistic expectations
- Support system adequacy

Respond with JSON:
{
  "overall_risk_score": 0.0-1.0,
  "risk_category": "low|moderate|high|critical",
  "risk_factors": {
    "subject_weakness_risk": 0.0-1.0,
    "time_management_risk": 0.0-1.0,
    "emotional_stress_risk": 0.0-1.0,
    "motivation_risk": 0.0-1.0,
    "support_system_risk": 0.0-1.0
  },
  "specific_concerns": [
    {
      "concern": "description of specific concern",
      "severity": "high|medium|low",
      "impact": "description of potential impact",
      "timeline": "immediate|short_term|long_term"
    }
  ],
  "improvement_recommendations": [
    {
      "area": "subject|study_habits|time_management|emotional_support",
      "recommendation": "specific actionable recommendation",
      "priority": "high|medium|low",
      "expected_impact": "description of expected improvement"
    }
  ],
  "intervention_timeline": {
    "immediate_actions": ["action1", "action2"],
    "short_term_goals": ["goal1", "goal2"],
    "long_term_strategies": ["strategy1", "strategy2"]
  }
}`;

      const analysisHistory = [{
        role: 'user',
        parts: [{ text: riskPrompt }]
      }];

      const response = await geminiClient.generateContent(analysisHistory, null, null, 1);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const assessment = JSON.parse(jsonMatch[0]);
        
        // Store assessment
        this.academicRiskAssessments.set(userId, {
          assessment,
          timestamp: Date.now()
        });
        
        // Process high-risk cases
        if (assessment.risk_category === 'high' || assessment.risk_category === 'critical') {
          await this.processHighRiskAcademicCase(userId, assessment);
        }
        
        logger.debug(`Academic risk assessment for ${userId}: ${assessment.risk_category} (${assessment.overall_risk_score.toFixed(2)})`);
        return assessment;
      }
      
      return null;
    } catch (error) {
      logger.error(`Error assessing academic risk for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Predict optimal study times for user
   */
  async optimizeStudyTiming(userId) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      const conversationHistory = await jsonDb.getMessagesForSender(userId);
      
      // Analyze conversation patterns to find optimal study times
      const messagesByTimeOfDay = {};
      const moodByTimeOfDay = {};
      
      conversationHistory.slice(-50).forEach(msg => {
        const timeOfDay = msg.timeOfDay;
        if (!messagesByTimeOfDay[timeOfDay]) {
          messagesByTimeOfDay[timeOfDay] = [];
        }
        messagesByTimeOfDay[timeOfDay].push(msg);
        
        // Extract mood indicators from messages
        const content = msg.content.toLowerCase();
        let moodScore = 0; // Neutral
        
        if (content.includes('tired') || content.includes('sleepy')) moodScore -= 2;
        if (content.includes('stressed') || content.includes('pressure')) moodScore -= 1;
        if (content.includes('good') || content.includes('happy')) moodScore += 1;
        if (content.includes('energetic') || content.includes('motivated')) moodScore += 2;
        
        if (!moodByTimeOfDay[timeOfDay]) moodByTimeOfDay[timeOfDay] = [];
        moodByTimeOfDay[timeOfDay].push(moodScore);
      });

      const optimizationPrompt = `STUDY TIME OPTIMIZATION ANALYSIS:

User Profile: ${JSON.stringify({
        academicInfo: memory.academicInfo,
        studyHabits: memory.academicInfo?.studyHabits || [],
        personalityTraits: memory.emotionalProfile?.personalityTraits || []
      }, null, 2)}

Conversation Patterns by Time: ${JSON.stringify(
        Object.keys(messagesByTimeOfDay).map(time => ({
          timeOfDay: time,
          messageCount: messagesByTimeOfDay[time].length,
          averageMoodScore: moodByTimeOfDay[time] ? 
            (moodByTimeOfDay[time].reduce((a, b) => a + b, 0) / moodByTimeOfDay[time].length).toFixed(2) : 0
        })), null, 2
      )}

ANALYZE and OPTIMIZE study schedule recommendations.

Consider:
- Natural energy patterns based on conversation timing
- Academic subject difficulty vs. optimal mental state times
- Sri Lankan A/L student typical schedules
- Individual personality and mood patterns
- Balance between study efficiency and well-being

Respond with JSON:
{
  "optimal_study_schedule": {
    "primary_study_time": {
      "period": "morning|afternoon|evening|night",
      "specific_hours": "7-9 AM",
      "confidence": 0.0-1.0,
      "reasoning": "why this is optimal"
    },
    "secondary_study_time": {
      "period": "morning|afternoon|evening|night", 
      "specific_hours": "7-9 PM",
      "confidence": 0.0-1.0,
      "reasoning": "why this is secondary optimal"
    }
  },
  "subject_timing_recommendations": [
    {
      "subject_type": "mathematics|science|languages|arts",
      "recommended_time": "specific time period",
      "reasoning": "why this timing works for this subject type"
    }
  ],
  "productivity_patterns": {
    "high_energy_periods": ["time1", "time2"],
    "low_energy_periods": ["time1", "time2"],
    "break_recommendations": ["when to take breaks"],
    "sleep_optimization": "recommended sleep schedule"
  },
  "personalized_tips": [
    {
      "tip": "specific study optimization tip",
      "category": "timing|environment|method|motivation",
      "expected_benefit": "description of benefit"
    }
  ]
}`;

      const analysisHistory = [{
        role: 'user',
        parts: [{ text: optimizationPrompt }]
      }];

      const response = await geminiClient.generateContent(analysisHistory, null, null, 1);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const optimization = JSON.parse(jsonMatch[0]);
        
        // Store optimization
        this.studyTimeOptimization.set(userId, {
          optimization,
          timestamp: Date.now()
        });
        
        logger.debug(`Study time optimization for ${userId}: ${optimization.optimal_study_schedule.primary_study_time.specific_hours}`);
        return optimization;
      }
      
      return null;
    } catch (error) {
      logger.error(`Error optimizing study timing for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Predict when user will need social support
   */
  async predictSocialSupportNeeds(userId) {
    try {
      const memory = await memoryManager.getUserMemory(userId);
      const moodPrediction = this.moodPredictions.get(userId);
      const academicRisk = this.academicRiskAssessments.get(userId);
      
      const supportPrompt = `SOCIAL SUPPORT NEEDS PREDICTION:

User Context: ${JSON.stringify({
        emotionalProfile: memory.emotionalProfile,
        relationships: Object.keys(memory.relationships).reduce((acc, type) => {
          acc[type] = Object.keys(memory.relationships[type]).length;
          return acc;
        }, {}),
        ongoingIssues: memory.conversationContext?.ongoingIssues || [],
        personalityTraits: memory.emotionalProfile?.personalityTraits || []
      }, null, 2)}

Mood Prediction: ${JSON.stringify(moodPrediction?.prediction?.mood_prediction || {}, null, 2)}

Academic Risk: ${JSON.stringify(academicRisk?.assessment?.risk_category || 'unknown', null, 2)}

PREDICT when and what type of social support this user will need.

Consider:
- Emotional patterns and predicted mood changes
- Academic stress cycles and exam periods
- Relationship dynamics and social connections
- Past support-seeking behavior patterns
- Personality-based coping mechanisms

Respond with JSON:
{
  "support_needs_timeline": {
    "immediate": {
      "probability": 0.0-1.0,
      "type": "emotional|academic|social|crisis",
      "reasoning": "why immediate support might be needed"
    },
    "short_term": {
      "probability": 0.0-1.0,
      "type": "emotional|academic|social|crisis", 
      "timing": "within 1-3 days",
      "reasoning": "why short-term support might be needed"
    },
    "medium_term": {
      "probability": 0.0-1.0,
      "type": "emotional|academic|social|crisis",
      "timing": "within 1-2 weeks", 
      "reasoning": "why medium-term support might be needed"
    }
  },
  "support_preferences": {
    "preferred_support_type": "advice|emotional_comfort|practical_help|just_listening",
    "communication_style": "direct|gentle|humorous|serious",
    "optimal_timing": "immediate|when_asked|proactive_checkin"
  },
  "intervention_recommendations": [
    {
      "timing": "immediate|hours|days|weeks",
      "intervention_type": "check_in|motivation|celebration|crisis_support|academic_help",
      "approach": "direct|gentle|playful|serious",
      "priority": "high|medium|low"
    }
  ]
}`;

      const analysisHistory = [{
        role: 'user',
        parts: [{ text: supportPrompt }]
      }];

      const response = await geminiClient.generateContent(analysisHistory, null, null, 1);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const prediction = JSON.parse(jsonMatch[0]);
        
        // Store prediction
        this.socialSupportPredictions.set(userId, {
          prediction,
          timestamp: Date.now()
        });
        
        // Schedule proactive interventions
        await this.scheduleProactiveInterventions(userId, prediction.intervention_recommendations);
        
        logger.debug(`Social support prediction for ${userId}: ${prediction.support_needs_timeline.immediate.type} (${prediction.support_needs_timeline.immediate.probability.toFixed(2)})`);
        return prediction;
      }
      
      return null;
    } catch (error) {
      logger.error(`Error predicting social support needs for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Process intervention recommendations
   */
  async processInterventionRecommendations(userId, recommendations) {
    try {
      for (const recommendation of recommendations) {
        if (recommendation.priority === 'high') {
          // Schedule immediate high-priority interventions
          if (recommendation.timing === 'immediate') {
            await this.executeImmediateIntervention(userId, recommendation);
          } else {
            // Schedule for later
            setTimeout(() => {
              this.executeScheduledIntervention(userId, recommendation);
            }, this.getTimingDelay(recommendation.timing));
          }
        }
      }
    } catch (error) {
      logger.error('Error processing intervention recommendations:', error);
    }
  }

  /**
   * Execute immediate intervention
   */
  async executeImmediateIntervention(userId, recommendation) {
    try {
      switch (recommendation.type) {
        case 'crisis_support':
          proactiveEngagementManager.markUserInCrisis(userId, 'high', recommendation.reason);
          break;
        case 'check_in':
          // Trigger immediate check-in
          const checkInContext = { riskScore: 5, factors: [recommendation.reason] };
          await proactiveEngagementManager.sendMentalHealthCheckIn(userId, checkInContext);
          break;
        case 'motivation':
          // Send motivational message
          break;
        default:
          logger.debug(`Unhandled intervention type: ${recommendation.type}`);
      }
      
      logger.info(`Executed immediate intervention for ${userId}: ${recommendation.type}`);
    } catch (error) {
      logger.error('Error executing immediate intervention:', error);
    }
  }

  /**
   * Get timing delay in milliseconds
   */
  getTimingDelay(timing) {
    switch (timing) {
      case '4h': return 4 * 60 * 60 * 1000;
      case '12h': return 12 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000; // 1 hour default
    }
  }

  /**
   * Process high-risk academic cases
   */
  async processHighRiskAcademicCase(userId, assessment) {
    try {
      logger.warn(`High academic risk detected for ${userId}: ${assessment.risk_category}`);
      
      // Trigger academic support interventions
      for (const recommendation of assessment.improvement_recommendations) {
        if (recommendation.priority === 'high') {
          // Store as high-priority academic support need
          await memoryManager.addToMemoryArray(userId, 'conversationContext', 'ongoingIssues', {
            issue: `Academic risk: ${recommendation.area} - ${recommendation.recommendation}`,
            type: 'academic_risk',
            priority: 'high',
            status: 'active'
          });
        }
      }
      
      // Schedule academic support message
      setTimeout(async () => {
        await this.sendAcademicSupportMessage(userId, assessment);
      }, 30 * 60 * 1000); // 30 minutes delay
      
    } catch (error) {
      logger.error('Error processing high-risk academic case:', error);
    }
  }

  /**
   * Send academic support message
   */
  async sendAcademicSupportMessage(userId, assessment) {
    try {
      // This would integrate with proactive engagement manager
      // For now, just log the action
      logger.info(`Academic support message needed for ${userId} - ${assessment.risk_category} risk`);
    } catch (error) {
      logger.error('Error sending academic support message:', error);
    }
  }

  /**
   * Schedule proactive interventions
   */
  async scheduleProactiveInterventions(userId, recommendations) {
    try {
      for (const recommendation of recommendations) {
        if (recommendation.priority === 'high' || recommendation.priority === 'medium') {
          // Schedule with proactive engagement manager
          // This could be enhanced to integrate more deeply
          logger.debug(`Scheduled intervention for ${userId}: ${recommendation.intervention_type} in ${recommendation.timing}`);
        }
      }
    } catch (error) {
      logger.error('Error scheduling proactive interventions:', error);
    }
  }

  /**
   * Update mood predictions (run every 4 hours)
   */
  async updateMoodPredictions() {
    try {
      const activeUsers = await this.getActiveUsers();
      
      for (const userId of activeUsers) {
        // Update mood prediction for shorter time horizon
        await this.predictUserMood(userId, 12); // 12-hour prediction
      }
      
      logger.success(`Mood predictions updated for ${activeUsers.length} users`);
    } catch (error) {
      logger.error('Error updating mood predictions:', error);
    }
  }

  /**
   * Perform weekly academic risk assessment
   */
  async performAcademicRiskAssessment() {
    try {
      const activeUsers = await this.getActiveUsers();
      
      for (const userId of activeUsers) {
        await this.assessAcademicRisk(userId);
      }
      
      logger.success(`Academic risk assessment completed for ${activeUsers.length} users`);
    } catch (error) {
      logger.error('Error in academic risk assessment:', error);
    }
  }

  /**
   * Optimize study recommendations daily
   */
  async optimizeStudyRecommendations() {
    try {
      const activeUsers = await this.getActiveUsers();
      
      for (const userId of activeUsers) {
        await this.optimizeStudyTiming(userId);
      }
      
      logger.success(`Study optimization completed for ${activeUsers.length} users`);
    } catch (error) {
      logger.error('Error optimizing study recommendations:', error);
    }
  }

  /**
   * Get prediction for a specific user
   */
  getUserPrediction(userId, predictionType) {
    switch (predictionType) {
      case 'mood':
        return this.moodPredictions.get(userId);
      case 'academic_risk':
        return this.academicRiskAssessments.get(userId);
      case 'study_optimization':
        return this.studyTimeOptimization.get(userId);
      case 'social_support':
        return this.socialSupportPredictions.get(userId);
      default:
        return null;
    }
  }

  /**
   * Get predictive AI status
   */
  getStatus() {
    return {
      moodPredictions: this.moodPredictions.size,
      academicRiskAssessments: this.academicRiskAssessments.size,
      studyOptimizations: this.studyTimeOptimization.size,
      socialSupportPredictions: this.socialSupportPredictions.size,
      predictionAccuracy: this.predictionAccuracy.size
    };
  }
}

// Export singleton instance
export const predictiveAI = new PredictiveAI();