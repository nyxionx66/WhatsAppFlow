import { createModuleLogger } from './logger.js';

const logger = createModuleLogger('PerformanceMonitor');

export class PerformanceMonitor {
  constructor() {
    this.startTime = Date.now();
    this.events = [];
    this.metrics = {
      messagesProcessed: 0,
      averageResponseTime: 0,
      errorCount: 0,
      memoryUsage: 0,
      activeConnections: 0
    };
    this.monitoring = false;
    this.monitorInterval = null;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.startTime = Date.now();
    
    // Monitor memory usage every 30 seconds
    this.monitorInterval = setInterval(() => {
      this.updateMemoryMetrics();
    }, 30000);
    
    logger.success('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.monitoring) return;
    
    this.monitoring = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    logger.info('Performance monitoring stopped');
  }

  /**
   * Record an event for performance tracking
   */
  recordEvent(eventType, data = {}) {
    if (!this.monitoring) return;
    
    const event = {
      type: eventType,
      timestamp: Date.now(),
      data
    };
    
    this.events.push(event);
    
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
    
    // Update metrics based on event type
    this.updateMetrics(event);
  }

  /**
   * Update metrics based on event
   */
  updateMetrics(event) {
    switch (event.type) {
      case 'message_processed':
        this.metrics.messagesProcessed++;
        if (event.data.responseTime) {
          this.updateAverageResponseTime(event.data.responseTime);
        }
        break;
      case 'error_occurred':
        this.metrics.errorCount++;
        break;
      case 'whatsapp_connected':
        this.metrics.activeConnections++;
        break;
      case 'whatsapp_disconnected':
        this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
        break;
    }
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(responseTime) {
    const currentAvg = this.metrics.averageResponseTime;
    const count = this.metrics.messagesProcessed;
    
    this.metrics.averageResponseTime = ((currentAvg * (count - 1)) + responseTime) / count;
  }

  /**
   * Update memory usage metrics
   */
  updateMemoryMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024); // MB
    
    // Log warning if memory usage is high
    if (this.metrics.memoryUsage > 500) {
      logger.warn(`High memory usage detected: ${this.metrics.memoryUsage}MB`);
    }
  }

  /**
   * Get current performance statistics
   */
  getStats() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    return {
      uptime,
      messagesProcessed: this.metrics.messagesProcessed,
      averageResponseTime: Math.round(this.metrics.averageResponseTime),
      errorCount: this.metrics.errorCount,
      memoryUsage: this.metrics.memoryUsage,
      activeConnections: this.metrics.activeConnections,
      eventsRecorded: this.events.length,
      messagesPerMinute: this.calculateMessagesPerMinute()
    };
  }

  /**
   * Calculate messages per minute
   */
  calculateMessagesPerMinute() {
    const uptime = (Date.now() - this.startTime) / 1000 / 60; // minutes
    return uptime > 0 ? Math.round(this.metrics.messagesProcessed / uptime) : 0;
  }

  /**
   * Get recent events
   */
  getRecentEvents(count = 50) {
    return this.events.slice(-count);
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const stats = this.getStats();
    const recentEvents = this.getRecentEvents(10);
    
    return {
      timestamp: new Date().toISOString(),
      systemStats: stats,
      recentEvents: recentEvents,
      healthStatus: this.getHealthStatus(stats)
    };
  }

  /**
   * Determine system health status
   */
  getHealthStatus(stats) {
    const issues = [];
    
    if (stats.memoryUsage > 800) {
      issues.push('High memory usage');
    }
    
    if (stats.averageResponseTime > 5000) {
      issues.push('Slow response times');
    }
    
    if (stats.errorCount > stats.messagesProcessed * 0.1) {
      issues.push('High error rate');
    }
    
    if (stats.activeConnections === 0) {
      issues.push('No active connections');
    }
    
    return {
      status: issues.length === 0 ? 'healthy' : 'warning',
      issues: issues
    };
  }

  /**
   * Record message processing performance
   */
  recordMessageProcessing(startTime, endTime, success = true) {
    const responseTime = endTime - startTime;
    
    this.recordEvent('message_processed', {
      responseTime,
      success
    });
    
    if (!success) {
      this.recordEvent('error_occurred', {
        context: 'message_processing',
        responseTime
      });
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();