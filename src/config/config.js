import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

/**
 * WhatsAppFlow Configuration System
 * Centralized configuration with validation and environment variable support
 */
export const config = {
  // Application Info
  app: {
    name: 'WhatsAppFlow',
    version: '2.0.0',
    description: 'Advanced AI-powered WhatsApp chatbot with dynamic persona and proactive engagement',
    environment: process.env.NODE_ENV || 'development'
  },

  // Gemini AI Configuration
  gemini: {
    apiKeys: process.env.GEMINI_API_KEYS?.split(',').map(key => key.trim()) || [],
    model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 8192,
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.8,
    thinkingBudget: parseInt(process.env.GEMINI_THINKING_BUDGET) || -1,
    
    // Enhanced Gemini settings
    safetySettings: {
      harassment: process.env.GEMINI_SAFETY_HARASSMENT || 'BLOCK_MEDIUM_AND_ABOVE',
      hateSpeech: process.env.GEMINI_SAFETY_HATE_SPEECH || 'BLOCK_MEDIUM_AND_ABOVE', 
      sexuallyExplicit: process.env.GEMINI_SAFETY_SEXUAL || 'BLOCK_MEDIUM_AND_ABOVE',
      dangerousContent: process.env.GEMINI_SAFETY_DANGEROUS || 'BLOCK_MEDIUM_AND_ABOVE'
    },
    
    // Request configuration
    timeout: parseInt(process.env.GEMINI_TIMEOUT) || 30000,
    maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.GEMINI_RETRY_DELAY) || 1000
  },

  // Bot Behavior Configuration
  bot: {
    maxChatHistory: parseInt(process.env.MAX_CHAT_HISTORY) || 50,
    thinkingDelay: parseInt(process.env.THINKING_DELAY) || 1500,
    proactiveMessaging: process.env.PROACTIVE_MESSAGING !== 'false',
    proactiveInterval: parseInt(process.env.PROACTIVE_INTERVAL) || 1800000,
    verboseLogging: process.env.VERBOSE_LOGGING === 'true',
    
    // Enhanced bot settings
    rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE) || 10,
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH) || 4000,
    enableTypingIndicator: process.env.ENABLE_TYPING_INDICATOR !== 'false',
    enableReadReceipts: process.env.ENABLE_READ_RECEIPTS !== 'false',
    autoSaveInterval: parseInt(process.env.AUTO_SAVE_INTERVAL) || 300000 // 5 minutes
  },

  // File System Paths
  paths: {
    chatHistoryFile: process.env.CHAT_HISTORY_FILE || 'data/chat_history.json',
    sessionDir: process.env.SESSION_DIR || 'sessions',
    logsDir: process.env.LOGS_DIR || 'logs',
    backupDir: process.env.BACKUP_DIR || 'backups',
    projectRoot: path.resolve(__dirname, '../..')
  },

  // Persona System Configuration
  persona: {
    // Core Identity
    name: process.env.PERSONA_NAME || 'Sandun',
    age: parseInt(process.env.PERSONA_AGE) || 17,
    gender: process.env.PERSONA_GENDER || 'male',
    
    // Education Details
    education: {
      level: process.env.PERSONA_EDUCATION_LEVEL || 'Advanced Level (A/L) student',
      school: process.env.PERSONA_EDUCATION_SCHOOL || 'Royal College Colombo', 
      subjects: process.env.PERSONA_EDUCATION_SUBJECTS?.split(',').map(s => s.trim()) || 
                ['Physics', 'Chemistry', 'Combined Mathematics'],
      grade: process.env.PERSONA_EDUCATION_GRADE || 'Grade 13',
      stream: process.env.PERSONA_EDUCATION_STREAM || 'Physical Science'
    },
    
    // Location Information
    location: {
      city: process.env.PERSONA_LOCATION_CITY || 'Colombo',
      country: process.env.PERSONA_LOCATION_COUNTRY || 'Sri Lanka',
      region: process.env.PERSONA_LOCATION_REGION || 'Western Province',
      timezone: process.env.PERSONA_TIMEZONE || 'Asia/Colombo'
    },
    
    // Personality Traits
    personality_traits: process.env.PERSONA_PERSONALITY_TRAITS?.split(',').map(t => t.trim()) || [
      'supportive', 'caring', 'friendly', 'understanding', 'empathetic', 
      'humorous', 'loyal', 'optimistic', 'intelligent', 'creative',
      'patient', 'encouraging', 'protective', 'authentic'
    ],
    
    // Background Story
    background: process.env.PERSONA_BACKGROUND || 
      `A 17-year-old A/L Physical Science student from Royal College Colombo who deeply understands the pressures and challenges faced by Sri Lankan students. Has personal experience with exam stress, family expectations, peer relationships, and the complex social dynamics of teenage life in Sri Lanka. Speaks in a natural mix of Sinhala, Singlish, and English, adapting to the user's preferred communication style.`,
    
    // Interests and Hobbies
    interests: process.env.PERSONA_INTERESTS?.split(',').map(i => i.trim()) || [
      'Physics', 'Science', 'Technology', 'Music', 'Movies', 'Cricket', 
      'Gaming', 'Social Media', 'Friendship', 'Academic Success', 'Future Planning',
      'Photography', 'Anime', 'K-dramas', 'Local culture', 'Travel dreams'
    ],
    
    // Communication Style Rules
    communication_style: process.env.PERSONA_COMMUNICATION_STYLE?.split(',').map(s => s.trim()) || [
      'Use natural Sri Lankan Singlish/Sinhala mix based on user preference',
      'Be genuinely supportive and understanding without being preachy',
      'Remember and reference personal details shared by friends',
      'Show authentic care for academic and emotional wellbeing',
      'Use age-appropriate language and cultural references',
      'Be encouraging during difficult times and celebrate achievements enthusiastically',
      'Give practical academic advice based on personal experience',
      'Maintain consistency in personality while adapting to relationship depth',
      'Use appropriate emojis and expressions naturally',
      'Share relatable personal experiences when helpful'
    ],
    
    // Special Behavioral Rules
    special_rules: process.env.PERSONA_SPECIAL_RULES?.split(',').map(r => r.trim()) || [
      'Always remember important details about friends and family',
      'Provide emotional support during exam stress and academic pressure',
      'Help with relationship advice based on teenage experience',
      'Share relatable experiences about A/L life and Sri Lankan student culture',
      'Never judge or criticize - always be understanding',
      'Be immediately available during crisis moments with heightened care',
      'Encourage healthy study habits and work-life balance',
      'Support academic goals while emphasizing mental health',
      'Be protective of close friends and their wellbeing',
      'Adapt personality depth based on relationship level',
      'Remember ongoing issues and follow up naturally',
      'Celebrate achievements with genuine excitement'
    ],
    
    // Relationship Evolution Settings
    relationship_evolution: process.env.PERSONA_RELATIONSHIP_EVOLUTION !== 'false',
    max_relationship_level: parseInt(process.env.PERSONA_MAX_RELATIONSHIP_LEVEL) || 5,
    relationship_decay: process.env.PERSONA_RELATIONSHIP_DECAY === 'true',
    
    // Dynamic Personality Settings
    adapt_to_mood: process.env.PERSONA_ADAPT_TO_MOOD !== 'false',
    context_awareness: process.env.PERSONA_CONTEXT_AWARENESS !== 'false',
    memory_integration: process.env.PERSONA_MEMORY_INTEGRATION !== 'false'
  },

  // AI Features Configuration
  features: {
    // Proactive Engagement Features
    proactive: {
      mental_health_checkins: process.env.PROACTIVE_MENTAL_HEALTH_CHECKINS !== 'false',
      study_motivation: process.env.PROACTIVE_STUDY_MOTIVATION !== 'false',
      celebration_system: process.env.PROACTIVE_CELEBRATION_SYSTEM !== 'false',
      crisis_monitoring: process.env.PROACTIVE_CRISIS_MONITORING !== 'false',
      friendship_maintenance: process.env.PROACTIVE_FRIENDSHIP_MAINTENANCE !== 'false',
      
      // Timing configurations
      checkin_interval: parseInt(process.env.PROACTIVE_CHECKIN_INTERVAL) || 21600000, // 6 hours
      motivation_time: process.env.PROACTIVE_MOTIVATION_TIME || '19:00', // 7 PM
      crisis_check_interval: parseInt(process.env.PROACTIVE_CRISIS_CHECK_INTERVAL) || 1800000, // 30 min
      maintenance_day: process.env.PROACTIVE_MAINTENANCE_DAY || 'sunday'
    },
    
    // Predictive AI Features
    predictive: {
      mood_analysis: process.env.PREDICTIVE_MOOD_ANALYSIS !== 'false',
      academic_risk: process.env.PREDICTIVE_ACADEMIC_RISK !== 'false',
      study_optimization: process.env.PREDICTIVE_STUDY_OPTIMIZATION !== 'false',
      social_support: process.env.PREDICTIVE_SOCIAL_SUPPORT !== 'false',
      
      // Analysis settings
      prediction_horizon: parseInt(process.env.PREDICTIVE_HORIZON) || 12, // hours
      confidence_threshold: parseFloat(process.env.PREDICTIVE_CONFIDENCE_THRESHOLD) || 0.7
    },
    
    // Dynamic Personality Features
    dynamic: {
      personality_evolution: process.env.DYNAMIC_PERSONALITY_EVOLUTION !== 'false',
      relationship_tracking: process.env.DYNAMIC_RELATIONSHIP_TRACKING !== 'false',
      context_adaptation: process.env.DYNAMIC_CONTEXT_ADAPTATION !== 'false',
      
      // Evolution settings
      evolution_rate: parseFloat(process.env.DYNAMIC_EVOLUTION_RATE) || 0.1,
      memory_weight: parseFloat(process.env.DYNAMIC_MEMORY_WEIGHT) || 0.3
    },

    // Memory System Features
    memory: {
      ai_memory_analysis: process.env.MEMORY_AI_ANALYSIS !== 'false',
      emotional_profiling: process.env.MEMORY_EMOTIONAL_PROFILING !== 'false',
      relationship_memory: process.env.MEMORY_RELATIONSHIP_TRACKING !== 'false',
      academic_memory: process.env.MEMORY_ACADEMIC_TRACKING !== 'false',
      
      // Memory settings
      max_memory_age_days: parseInt(process.env.MEMORY_MAX_AGE_DAYS) || 90,
      memory_consolidation_interval: parseInt(process.env.MEMORY_CONSOLIDATION_INTERVAL) || 86400000 // 24 hours
    }
  },

  // Performance and Advanced Settings
  advanced: {
    max_memory_cache_size: parseInt(process.env.MAX_MEMORY_CACHE_SIZE) || 2000,
    prediction_cache_ttl: parseInt(process.env.PREDICTION_CACHE_TTL) || 3600000, // 1 hour
    relationship_update_frequency: parseInt(process.env.RELATIONSHIP_UPDATE_FREQUENCY) || 300000, // 5 minutes
    
    // Performance monitoring
    enable_performance_monitoring: process.env.ENABLE_PERFORMANCE_MONITORING !== 'false',
    performance_log_interval: parseInt(process.env.PERFORMANCE_LOG_INTERVAL) || 300000, // 5 minutes
    
    // Database settings
    database_backup_interval: parseInt(process.env.DATABASE_BACKUP_INTERVAL) || 3600000, // 1 hour
    database_cleanup_interval: parseInt(process.env.DATABASE_CLEANUP_INTERVAL) || 21600000, // 6 hours
    
    // Connection settings
    whatsapp_reconnect_delay: parseInt(process.env.WHATSAPP_RECONNECT_DELAY) || 5000,
    whatsapp_max_reconnect_attempts: parseInt(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS) || 10,
    
    // Security settings
    enable_rate_limiting: process.env.ENABLE_RATE_LIMITING !== 'false',
    max_message_queue_size: parseInt(process.env.MAX_MESSAGE_QUEUE_SIZE) || 100
  },

  // Development and Debug Settings
  debug: {
    log_level: process.env.LOG_LEVEL || 'info',
    log_to_file: process.env.LOG_TO_FILE === 'true',
    debug_mode: process.env.DEBUG_MODE === 'true',
    verbose_ai_logs: process.env.VERBOSE_AI_LOGS === 'true',
    
    // Testing settings
    test_mode: process.env.TEST_MODE === 'true',
    mock_whatsapp: process.env.MOCK_WHATSAPP === 'true',
    mock_gemini: process.env.MOCK_GEMINI === 'true'
  }
};

/**
 * Validate configuration on startup
 */
export function validateConfig() {
  const errors = [];
  const warnings = [];

  // Critical validations
  if (config.gemini.apiKeys.length === 0) {
    errors.push('No Gemini API keys found. Please set GEMINI_API_KEYS in your .env file');
  }

  if (!config.persona.name) {
    errors.push('Persona name is required. Please set PERSONA_NAME in your .env file');
  }

  // Warning validations
  if (config.persona.age < 16 || config.persona.age > 20) {
    warnings.push('Persona age should be between 16-20 for A/L student context');
  }

  if (config.bot.maxChatHistory > 100) {
    warnings.push('Very high chat history limit may impact performance');
  }

  if (config.gemini.temperature > 1.0) {
    warnings.push('High temperature setting may cause unpredictable responses');
  }

  // Path validations
  const requiredPaths = ['chatHistoryFile', 'sessionDir'];
  requiredPaths.forEach(pathKey => {
    if (!config.paths[pathKey]) {
      errors.push(`Missing required path configuration: ${pathKey}`);
    }
  });

  return { errors, warnings };
}

/**
 * Get configuration summary for display
 */
export function getConfigSummary() {
  return {
    app: {
      name: config.app.name,
      version: config.app.version,
      environment: config.app.environment
    },
    persona: {
      name: config.persona.name,
      age: config.persona.age,
      location: `${config.persona.location.city}, ${config.persona.location.country}`,
      education: config.persona.education.level
    },
    features: {
      proactive_engagement: config.features.proactive.mental_health_checkins,
      predictive_ai: config.features.predictive.mood_analysis,
      dynamic_personality: config.features.dynamic.personality_evolution,
      ai_memory: config.features.memory.ai_memory_analysis
    },
    performance: {
      monitoring_enabled: config.advanced.enable_performance_monitoring,
      rate_limiting: config.advanced.enable_rate_limiting,
      max_chat_history: config.bot.maxChatHistory
    }
  };
}

// Validate configuration on import
const validation = validateConfig();
if (validation.errors.length > 0) {
  console.error('Configuration Errors:');
  validation.errors.forEach(error => console.error(error));
  process.exit(1);
}

if (validation.warnings.length > 0) {
  console.warn('Configuration Warnings:');
  validation.warnings.forEach(warning => console.warn(warning));
}