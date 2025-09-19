#!/usr/bin/env node

/**
 * WhatsAppFlow Health Check Utility
 * Provides system health monitoring and diagnostics
 */

import { performanceMonitor } from './performanceMonitor.js';
import { whatsappClient } from '../whatsapp/whatsappClient.js';
import { chatbotService } from '../services/chatbotService.js';
import { config } from '../config/config.js';
import { logger } from './logger.js';

class HealthCheck {
  constructor() {
    this.checks = new Map();
    this.initializeChecks();
  }

  /**
   * Initialize health checks
   */
  initializeChecks() {
    this.checks.set('whatsapp_connection', this.checkWhatsAppConnection.bind(this));
    this.checks.set('gemini_api', this.checkGeminiAPI.bind(this));
    this.checks.set('memory_usage', this.checkMemoryUsage.bind(this));
    this.checks.set('performance_metrics', this.checkPerformanceMetrics.bind(this));
    this.checks.set('configuration', this.checkConfiguration.bind(this));
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const results = {
      timestamp: new Date().toISOString(),
      overall_status: 'healthy',
      checks: {},
      summary: {
        total: this.checks.size,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };

    logger.info('Running WhatsAppFlow health checks...');

    for (const [checkName, checkFunction] of this.checks) {
      try {
        const result = await checkFunction();
        results.checks[checkName] = result;

        switch (result.status) {
          case 'healthy':
            results.summary.passed++;
            logger.info(`[PASS] ${checkName}: ${result.message}`);
            break;
          case 'warning':
            results.summary.warnings++;
            results.overall_status = 'warning';
            logger.warn(`[WARN] ${checkName}: ${result.message}`);
            break;
          case 'critical':
            results.summary.failed++;
            results.overall_status = 'critical';
            logger.error(`[FAIL] ${checkName}: ${result.message}`);
            break;
        }
      } catch (error) {
        results.checks[checkName] = {
          status: 'critical',
          message: `Health check failed: ${error.message}`,
          error: error.stack
        };
        results.summary.failed++;
        results.overall_status = 'critical';
        logger.error(`[ERROR] ${checkName}: Health check failed - ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Check WhatsApp connection status
   */
  async checkWhatsAppConnection() {
    const status = whatsappClient.getStatus();
    
    if (status.connected) {
      return {
        status: 'healthy',
        message: 'WhatsApp connection is active',
        details: status
      };
    } else if (status.reconnectAttempts > 0 && status.reconnectAttempts < status.maxReconnectAttempts) {
      return {
        status: 'warning',
        message: `WhatsApp reconnection in progress (${status.reconnectAttempts}/${status.maxReconnectAttempts})`,
        details: status
      };
    } else {
      return {
        status: 'critical',
        message: 'WhatsApp connection is down',
        details: status
      };
    }
  }

  /**
   * Check Gemini API configuration
   */
  async checkGeminiAPI() {
    if (config.gemini.apiKeys.length === 0) {
      return {
        status: 'critical',
        message: 'No Gemini API keys configured'
      };
    }

    return {
      status: 'healthy',
      message: `Gemini API configured with ${config.gemini.apiKeys.length} key(s)`,
      details: {
        model: config.gemini.model,
        maxTokens: config.gemini.maxTokens,
        temperature: config.gemini.temperature
      }
    };
  }

  /**
   * Check memory usage
   */
  async checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    let status = 'healthy';
    let message = `Memory usage: ${heapUsedMB}MB used / ${heapTotalMB}MB allocated`;

    if (heapUsedMB > 800) {
      status = 'critical';
      message += ' - High memory usage detected';
    } else if (heapUsedMB > 500) {
      status = 'warning';
      message += ' - Elevated memory usage';
    }

    return {
      status,
      message,
      details: {
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        external: Math.round(memUsage.external / 1024 / 1024),
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024)
      }
    };
  }

  /**
   * Check performance metrics
   */
  async checkPerformanceMetrics() {
    const stats = performanceMonitor.getStats();
    const health = performanceMonitor.getHealthStatus(stats);

    return {
      status: health.status === 'healthy' ? 'healthy' : 'warning',
      message: health.status === 'healthy' 
        ? `Performance metrics healthy - ${stats.messagesProcessed} messages processed`
        : `Performance issues detected: ${health.issues.join(', ')}`,
      details: {
        ...stats,
        issues: health.issues
      }
    };
  }

  /**
   * Check configuration
   */
  async checkConfiguration() {
    const issues = [];
    
    // Check persona configuration
    if (!config.persona.name) issues.push('Missing persona name');
    if (!config.persona.age) issues.push('Missing persona age');
    if (!config.persona.location.city) issues.push('Missing persona location');
    
    // Check feature configuration
    if (!config.features.proactive.mental_health_checkins) {
      issues.push('Mental health check-ins disabled');
    }
    
    if (issues.length === 0) {
      return {
        status: 'healthy',
        message: 'Configuration is complete',
        details: {
          persona: config.persona.name,
          location: `${config.persona.location.city}, ${config.persona.location.country}`,
          features_enabled: Object.keys(config.features).length
        }
      };
    } else {
      return {
        status: 'warning',
        message: `Configuration issues: ${issues.join(', ')}`,
        details: { issues }
      };
    }
  }

  /**
   * Generate health report
   */
  async generateHealthReport() {
    const healthResults = await this.runHealthChecks();
    const performanceReport = performanceMonitor.getPerformanceReport();

    return {
      ...healthResults,
      performance: performanceReport,
      system_info: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime()
      }
    };
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const healthCheck = new HealthCheck();
  
  healthCheck.generateHealthReport()
    .then(report => {
      console.log('\nWhatsAppFlow Health Report:');
      console.log('═'.repeat(50));
      console.log(JSON.stringify(report, null, 2));
      
      const exitCode = report.overall_status === 'critical' ? 1 : 0;
      process.exit(exitCode);
    })
    .catch(error => {
      logger.fatal('Health check failed:', error);
      process.exit(1);
    });
}

export { HealthCheck };