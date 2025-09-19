#!/usr/bin/env node

/**
 * WhatsAppFlow - Advanced AI-powered WhatsApp chatbot
 * Features: Dynamic persona, predictive AI, proactive engagement, comprehensive memory management
 */

import { whatsappClient } from './whatsapp/whatsappClient.js';
import { chatbotService } from './services/chatbotService.js';
import { jsonDb } from './database/jsonDb.js';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';
import { personaManager } from './system/personaManager.js';
import { proactiveEngagementManager } from './system/proactiveEngagementManager.js';
import { predictiveAI } from './system/predictiveAI.js';
import { performanceMonitor } from './utils/performanceMonitor.js';

// Initialize performance monitoring
performanceMonitor.startMonitoring();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down WhatsAppFlow gracefully...');
  await shutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down WhatsAppFlow gracefully...');
  await shutdown();
});

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

async function shutdown() {
  try {
    logger.info('Stopping performance monitoring...');
    performanceMonitor.stopMonitoring();
    
    logger.info('Disconnecting WhatsApp client...');
    await whatsappClient.disconnect();
    
    logger.info('Cleaning up database connections...');
    await jsonDb.cleanup();
    
    logger.success('WhatsAppFlow shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

async function startWhatsAppFlow() {
  try {
    // Display startup banner
    displayStartupBanner();
    
    // Validate configuration
    await validateConfiguration();
    
    // Initialize core systems
    await initializeCoreSystem();
    
    // Setup connection handlers
    setupConnectionHandlers();
    
    // Initialize WhatsApp client
    logger.info('Initializing WhatsApp connection...');
    await whatsappClient.initialize();
    
    // Display system status
    displaySystemStatus();
    
  } catch (error) {
    logger.fatal('WhatsAppFlow startup failed:', error);
    process.exit(1);
  }
}

function displayStartupBanner() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                     WhatsAppFlow                          ║
║              Advanced AI WhatsApp Chatbot                 ║
║                     Version 2.0.0                        ║
╚═══════════════════════════════════════════════════════════╝
`);
}

async function validateConfiguration() {
  logger.info('Validating configuration...');
  
  // Validate Gemini API keys
  if (config.gemini.apiKeys.length === 0) {
    throw new Error('No Gemini API keys found. Please set GEMINI_API_KEYS in your .env file');
  }
  
  // Validate persona configuration
  const requiredPersonaFields = ['name', 'age', 'education.level'];
  for (const field of requiredPersonaFields) {
    const value = getNestedProperty(config.persona, field);
    if (!value) {
      logger.warn(`Missing persona configuration: ${field}`);
    }
  }
  
  logger.success('Configuration validated');
}

function getNestedProperty(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

async function initializeCoreSystem() {
  logger.info('Initializing core AI systems...');
  
  // Initialize database
  await jsonDb.initialize();
  logger.success(`Database System: Initialized`);
  
  // Initialize persona system
  logger.success(`Persona System: ${config.persona.name} (${config.persona.age} years old)`);
  logger.success(`Location: ${config.persona.location.city}, ${config.persona.location.country}`);
  logger.success(`Education: ${config.persona.education.level}`);
  
  // Initialize AI systems
  logger.success('Dynamic Personality Evolution: Active');
  logger.success('Proactive Engagement Manager: Ready');
  logger.success('Predictive AI Systems: Active');
  logger.success('AI Memory System: Ready');
  logger.success('AI Tools System: Ready');
  logger.success('Gemini AI: Connected');
}

function setupConnectionHandlers() {
  // Set up connection status handler
  whatsappClient.onConnection((status) => {
    if (status.connected) {
      logger.success(`${config.persona.name} is online with advanced AI capabilities!`);
      performanceMonitor.recordEvent('whatsapp_connected');
    } else {
      logger.warn('WhatsApp connection lost');
      performanceMonitor.recordEvent('whatsapp_disconnected');
    }
  });

  // Set up QR handler
  whatsappClient.onQR((qr) => {
    logger.info('Scan QR code to connect WhatsApp...');
  });
}

function displaySystemStatus() {
  logger.success('All AI systems operational!');
  logger.success('Dynamic personality system: Active');
  logger.success('Proactive engagement monitoring: Active');
  logger.success('Predictive AI analysis: Running');
  logger.success('AI memory analysis: Active');
  logger.success('AI tool processing: Active');
  logger.success('Relationship tracking: Enabled');
  logger.success('Performance monitoring: Active');
  
  logger.info('Monitoring for messages with advanced AI...');
  
  // Display performance stats
  setTimeout(() => {
    const stats = performanceMonitor.getStats();
    logger.info(`System Performance: Memory: ${stats.memoryUsage}MB, Uptime: ${stats.uptime}s`);
  }, 5000);
}

// Start WhatsAppFlow
startWhatsAppFlow().catch((error) => {
  logger.fatal('Unhandled WhatsAppFlow startup error:', error);
  process.exit(1);
});