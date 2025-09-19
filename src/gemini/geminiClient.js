import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from '../config/config.js';
import { createModuleLogger } from '../utils/logger.js';
import { performanceMonitor } from '../utils/performanceMonitor.js';

const logger = createModuleLogger('GeminiClient');

export class GeminiClient {
  constructor() {
    this.clients = [];
    this.currentClientIndex = 0;
    this.requestCounts = new Map();
    this.errorCounts = new Map();
    this.lastRequestTimes = new Map();
    this.initializeClients();
  }

  /**
   * Initialize Gemini clients with all available API keys
   */
  initializeClients() {
    try {
      if (config.gemini.apiKeys.length === 0) {
        throw new Error('No Gemini API keys configured');
      }

      this.clients = config.gemini.apiKeys.map((apiKey, index) => {
        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({
          model: config.gemini.model,
          generationConfig: {
            maxOutputTokens: config.gemini.maxTokens,
            temperature: config.gemini.temperature,
            topP: 0.8,
            topK: 40
          },
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ],
        });

        // Initialize tracking for this client
        this.requestCounts.set(index, 0);
        this.errorCounts.set(index, 0);
        this.lastRequestTimes.set(index, 0);

        return { client, model, index };
      });

      logger.success(`Initialized ${this.clients.length} Gemini client(s) with model ${config.gemini.model}`);
    } catch (error) {
      logger.error('Failed to initialize Gemini clients:', error);
      throw error;
    }
  }

  /**
   * Get the best available client based on performance and error rates
   */
  getBestClient() {
    const now = Date.now();
    let bestClient = this.clients[0];
    let bestScore = -1;

    for (const client of this.clients) {
      const requestCount = this.requestCounts.get(client.index) || 0;
      const errorCount = this.errorCounts.get(client.index) || 0;
      const lastRequestTime = this.lastRequestTimes.get(client.index) || 0;
      
      // Calculate score based on error rate and recent usage
      const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
      const timeSinceLastRequest = now - lastRequestTime;
      
      // Lower error rate and longer time since last request = better score
      const score = (1 - errorRate) * 100 + Math.min(timeSinceLastRequest / 1000, 60);
      
      if (score > bestScore) {
        bestScore = score;
        bestClient = client;
      }
    }

    return bestClient;
  }

  /**
   * Generate content with enhanced error handling and retry logic
   */
  async generateContent(conversationHistory, memorySummary = null, userMemory = null, maxRetries = null) {
    const startTime = Date.now();
    const retries = maxRetries || config.gemini.maxRetries;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const client = this.getBestClient();
        this.updateRequestCount(client.index);

        // Prepare the full context
        let fullContext = [...conversationHistory];
        
        // Add memory context if available
        if (memorySummary && memorySummary.trim()) {
          fullContext.unshift({
            role: 'user',
            parts: [{ text: `MEMORY CONTEXT:\n${memorySummary}` }]
          });
          fullContext.push({
            role: 'model',
            parts: [{ text: 'I understand the memory context and will use it naturally in our conversation.' }]
          });
        }

        // Create chat session with full context
        const chat = client.model.startChat({
          history: fullContext.slice(0, -1), // All except the last message
          generationConfig: {
            maxOutputTokens: config.gemini.maxTokens,
            temperature: config.gemini.temperature
          }
        });

        // Get the last message to send
        const lastMessage = fullContext[fullContext.length - 1];
        const messageText = lastMessage.parts[0].text;

        // Generate response with timeout
        const response = await Promise.race([
          chat.sendMessage(messageText),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), config.gemini.timeout)
          )
        ]);

        // Extract and validate response
        const responseText = response.response.text();
        if (!responseText || responseText.trim().length === 0) {
          throw new Error('Empty response from Gemini');
        }

        // Record successful request
        const processingTime = Date.now() - startTime;
        this.updateLastRequestTime(client.index);
        
        performanceMonitor.recordEvent('gemini_request_success', {
          clientIndex: client.index,
          attempt,
          processingTime,
          responseLength: responseText.length,
          contextLength: JSON.stringify(fullContext).length
        });

        logger.debug(`Gemini response generated successfully (${processingTime}ms, attempt ${attempt + 1})`);
        return responseText;

      } catch (error) {
        lastError = error;
        
        // Update error count for the client
        const currentClient = this.getBestClient();
        this.updateErrorCount(currentClient.index);

        const isRetryableError = this.isRetryableError(error);
        
        logger.warn(`Gemini request failed (attempt ${attempt + 1}/${retries + 1}): ${error.message}`);
        
        // Don't retry if it's not a retryable error and we're on the last attempt
        if (!isRetryableError && attempt === retries) {
          break;
        }

        // Wait before retry with exponential backoff
        if (attempt < retries) {
          const delay = config.gemini.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        performanceMonitor.recordEvent('gemini_request_retry', {
          attempt,
          error: error.message,
          isRetryable: isRetryableError
        });
      }
    }

    // All retries failed
    const processingTime = Date.now() - startTime;
    
    performanceMonitor.recordEvent('gemini_request_failed', {
      totalAttempts: retries + 1,
      processingTime,
      finalError: lastError?.message
    });

    logger.error(`Gemini request failed after ${retries + 1} attempts:`, lastError);
    throw new Error(`Gemini request failed: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Determine if an error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'Request timeout',
      'RATE_LIMIT_EXCEEDED',
      'INTERNAL',
      'UNAVAILABLE',
      'DEADLINE_EXCEEDED',
      'Internal error',
      'Service temporarily unavailable'
    ];

    const errorMessage = error.message || '';
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  /**
   * Update request count for a client
   */
  updateRequestCount(clientIndex) {
    const currentCount = this.requestCounts.get(clientIndex) || 0;
    this.requestCounts.set(clientIndex, currentCount + 1);
  }

  /**
   * Update error count for a client
   */
  updateErrorCount(clientIndex) {
    const currentCount = this.errorCounts.get(clientIndex) || 0;
    this.errorCounts.set(clientIndex, currentCount + 1);
  }

  /**
   * Update last request time for a client
   */
  updateLastRequestTime(clientIndex) {
    this.lastRequestTimes.set(clientIndex, Date.now());
  }

  /**
   * Generate simple response without conversation context (for tools/analysis)
   */
  async generateSimpleResponse(prompt, maxRetries = 2) {
    const conversationHistory = [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ];

    return this.generateContent(conversationHistory, null, null, maxRetries);
  }

  /**
   * Get client statistics
   */
  getStats() {
    const stats = {
      totalClients: this.clients.length,
      clients: []
    };

    for (const client of this.clients) {
      stats.clients.push({
        index: client.index,
        requestCount: this.requestCounts.get(client.index) || 0,
        errorCount: this.errorCounts.get(client.index) || 0,
        lastRequestTime: this.lastRequestTimes.get(client.index) || 0,
        errorRate: this.calculateErrorRate(client.index)
      });
    }

    return stats;
  }

  /**
   * Calculate error rate for a client
   */
  calculateErrorRate(clientIndex) {
    const requestCount = this.requestCounts.get(clientIndex) || 0;
    const errorCount = this.errorCounts.get(clientIndex) || 0;
    
    if (requestCount === 0) return 0;
    return (errorCount / requestCount) * 100;
  }

  /**
   * Reset statistics (useful for monitoring)
   */
  resetStats() {
    for (const client of this.clients) {
      this.requestCounts.set(client.index, 0);
      this.errorCounts.set(client.index, 0);
      this.lastRequestTimes.set(client.index, 0);
    }
    logger.info('Gemini client statistics reset');
  }

  /**
   * Health check for Gemini connectivity
   */
  async healthCheck() {
    try {
      const testResponse = await this.generateSimpleResponse(
        'Respond with exactly "OK" if you can understand this message.',
        1
      );
      
      const isHealthy = testResponse.trim().toLowerCase().includes('ok');
      
      return {
        healthy: isHealthy,
        response: testResponse,
        stats: this.getStats()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        stats: this.getStats()
      };
    }
  }
}

// Export singleton instance
export const geminiClient = new GeminiClient();