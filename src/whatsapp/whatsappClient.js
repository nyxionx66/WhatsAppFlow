import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { config } from '../config/config.js';
import { FileUtils } from '../utils/fileUtils.js';
import { createModuleLogger } from '../utils/logger.js';
import { performanceMonitor } from '../utils/performanceMonitor.js';

const logger = createModuleLogger('WhatsAppClient');

export class WhatsAppClient {
  constructor() {
    this.sock = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.advanced.whatsapp_max_reconnect_attempts;
    this.qrAttempts = 0;
    this.maxQrAttempts = 15; // Increased QR attempts
    this.messageHandlers = [];
    this.connectionHandlers = [];
    this.qrHandlers = [];
    this.isRestarting = false;
    this.connectionState = 'disconnected';
    this.lastConnectionTime = null;
    this.healthCheckInterval = null;
    this.retryTimeouts = new Set();
    
    // Enhanced connection monitoring
    this.connectionMetrics = {
      totalConnections: 0,
      totalDisconnections: 0,
      totalReconnects: 0,
      lastDisconnectReason: null,
      connectionUptime: 0,
      averageConnectionDuration: 0
    };
  }

  /**
   * Initialize WhatsApp client with enhanced session management
   */
  async initialize() {
    try {
      // Clear any existing retry timeouts
      this.clearRetryTimeouts();
      
      // Ensure session directory exists
      await FileUtils.ensureDir(config.paths.sessionDir);
      
      logger.info('Setting up enhanced session management...');

      // Create auth state with retry logic
      const authState = await this.createAuthStateWithRetry();
      const { state, saveCreds } = authState;
      
      // Get Baileys version with fallback
      const { version, isLatest } = await this.getBaileysVersionWithFallback();
      
      logger.info(`Using Baileys version: ${version.join('.')} ${isLatest ? '(latest)' : '(outdated)'}`);

      // Create optimized logger for Baileys
      const baileysLogger = this.createBaileysLogger();

      // Create WhatsApp socket with enhanced configuration
      this.sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger)
        },
        version,
        printQRInTerminal: false,
        logger: baileysLogger,
        browser: Browsers.macOS('WhatsAppFlow'),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        fireInitQueries: true,
        emitOwnEvents: false,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 90000, // Increased timeout
        keepAliveIntervalMs: 25000, // More frequent keep-alive
        retryRequestDelayMs: 3000,
        maxMsgRetryCount: 5,
        getMessage: async (key) => undefined
      });

      // Set up enhanced event handlers
      this.setupEnhancedEventHandlers(saveCreds);

      // Start health monitoring
      this.startHealthMonitoring();

      // Reset reconnect attempts on successful initialization
      this.reconnectAttempts = 0;
      this.connectionState = 'initializing';

      logger.success('WhatsApp client initialized successfully');
      performanceMonitor.recordEvent('whatsapp_initialized');
      
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
      performanceMonitor.recordEvent('whatsapp_init_failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Create auth state with enhanced retry logic
   */
  async createAuthStateWithRetry(maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const fs = await import('fs');
        const files = await fs.promises.readdir(config.paths.sessionDir).catch(() => []);
        
        if (files.length === 0) {
          logger.info('No existing session found, will show QR code for pairing');
        } else {
          logger.info(`Found existing session files: ${files.length} files`);
        }

        return await useMultiFileAuthState(config.paths.sessionDir);
        
      } catch (error) {
        logger.warn(`Auth state creation failed (attempt ${attempt + 1}/${maxRetries}):`, error.message);
        
        if (attempt < maxRetries - 1) {
          // Clear corrupted session and try again
          try {
            await FileUtils.clearDirectory(config.paths.sessionDir);
            await FileUtils.ensureDir(config.paths.sessionDir);
            logger.info('Session cleared, retrying with fresh auth state');
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (clearError) {
            logger.error('Failed to clear session directory:', clearError);
          }
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Get Baileys version with enhanced fallback
   */
  async getBaileysVersionWithFallback() {
    try {
      const versionInfo = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Version fetch timeout')), 10000)
        )
      ]);
      
      return {
        version: versionInfo.version,
        isLatest: versionInfo.isLatest
      };
    } catch (error) {
      logger.warn('Could not fetch latest Baileys version, using fallback:', error.message);
      return {
        version: [2, 3000, 1023223821],
        isLatest: false
      };
    }
  }

  /**
   * Create optimized Baileys logger
   */
  createBaileysLogger() {
    return {
      fatal: (msg) => logger.error('Baileys Fatal:', msg),
      error: (msg) => logger.error('Baileys Error:', msg),
      warn: (msg) => config.debug.verbose_ai_logs ? logger.warn('Baileys Warning:', msg) : null,
      info: (msg) => config.debug.verbose_ai_logs ? logger.info('Baileys Info:', msg) : null,
      debug: () => {}, // Always suppress debug
      trace: () => {}, // Always suppress trace
      child: () => this.createBaileysLogger(),
      silent: () => {}
    };
  }

  /**
   * Set up enhanced event handlers with better error recovery
   */
  setupEnhancedEventHandlers(saveCreds) {
    // Enhanced connection updates
    this.sock.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(update);
    });

    // Credentials update with error handling
    this.sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
        logger.debug('Credentials updated successfully');
      } catch (error) {
        logger.error('Failed to save credentials:', error);
      }
    });

    // Enhanced message handling
    this.sock.ev.on('messages.upsert', async (m) => {
      await this.handleMessagesUpsert(m);
    });

    // Connection events monitoring
    this.sock.ev.on('connection.update', (update) => {
      if (update.connection === 'open') {
        this.connectionMetrics.totalConnections++;
        this.lastConnectionTime = Date.now();
      } else if (update.connection === 'close') {
        this.connectionMetrics.totalDisconnections++;
        if (this.lastConnectionTime) {
          const duration = Date.now() - this.lastConnectionTime;
          this.connectionMetrics.connectionUptime += duration;
          this.updateAverageConnectionDuration();
        }
      }
    });
  }

  /**
   * Handle connection updates with enhanced logic
   */
  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    // Handle QR code display
    if (qr) {
      this.handleQRCode(qr);
      return;
    }

    // Handle connection states
    if (connection === 'close') {
      await this.handleConnectionClose(lastDisconnect);
    } else if (connection === 'open') {
      await this.handleConnectionOpen();
    } else if (connection === 'connecting') {
      this.handleConnectionConnecting();
    }
  }

  /**
   * Handle QR code with enhanced display
   */
  handleQRCode(qr) {
    this.qrAttempts++;
    logger.info(`QR Code ready for scanning (${this.qrAttempts}/${this.maxQrAttempts})`);
    
    console.log('\n' + '='.repeat(50));
    console.log('SCAN QR CODE WITH YOUR WHATSAPP');
    console.log('='.repeat(50));
    qrcode.generate(qr, { small: true });
    console.log('='.repeat(50));
    console.log(`QR Code expires in 30 seconds`);
    console.log(`Attempt ${this.qrAttempts} of ${this.maxQrAttempts}`);
    console.log('='.repeat(50) + '\n');
    
    // Notify QR handlers
    this.qrHandlers.forEach(handler => {
      try {
        handler(qr);
      } catch (error) {
        logger.error('Error in QR handler:', error);
      }
    });

    performanceMonitor.recordEvent('qr_code_generated', { attempt: this.qrAttempts });
  }

  /**
   * Handle connection close with enhanced recovery
   */
  async handleConnectionClose(lastDisconnect) {
    const reason = lastDisconnect?.error?.output?.statusCode;
    const reasonText = this.getDisconnectReason(reason);
    
    logger.warn(`Connection closed: ${reasonText} (Code: ${reason})`);
    
    this.isConnected = false;
    this.connectionState = 'disconnected';
    this.connectionMetrics.lastDisconnectReason = reasonText;
    
    performanceMonitor.recordEvent('whatsapp_disconnected', { 
      reason: reasonText, 
      code: reason 
    });

    // Enhanced reconnection logic
    await this.handleReconnectionLogic(reason);
    
    // Notify connection handlers
    this.notifyConnectionHandlers({ connected: false, reason: lastDisconnect?.error });
  }

  /**
   * Enhanced reconnection logic
   */
  async handleReconnectionLogic(reason) {
    const shouldReconnect = reason !== DisconnectReason.loggedOut;

    // Handle specific error cases
    switch (reason) {
      case 515: // Stream error
        logger.info('Stream error detected, immediate restart required');
        await this.scheduleRestart(2000, 'stream_error');
        break;

      case DisconnectReason.restartRequired:
        logger.info('Restart required after pairing');
        await this.scheduleRestart(3000, 'restart_required');
        break;

      case DisconnectReason.loggedOut:
      case DisconnectReason.timedOut:
        await this.handleQRTimeout();
        break;

      case DisconnectReason.connectionLost:
      case DisconnectReason.connectionClosed:
        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          await this.scheduleReconnect();
        }
        break;

      default:
        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          await this.scheduleReconnect();
        }
    }
  }

  /**
   * Handle QR timeout with regeneration
   */
  async handleQRTimeout() {
    if (this.qrAttempts <= this.maxQrAttempts) {
      logger.info(`QR code expired, generating new QR code... (${this.qrAttempts}/${this.maxQrAttempts})`);
      this.reconnectAttempts = 0; // Reset for QR regeneration
      await this.scheduleRestart(2000, 'qr_timeout');
    } else {
      logger.warn('Maximum QR generation attempts reached. Please restart the application.');
      this.connectionState = 'qr_exhausted';
    }
  }

  /**
   * Schedule restart with timeout management
   */
  async scheduleRestart(delay, reason) {
    if (this.isRestarting) return;
    
    this.isRestarting = true;
    logger.info(`Scheduling restart in ${delay}ms (reason: ${reason})`);
    
    const timeout = setTimeout(async () => {
      try {
        await this.initialize();
        this.isRestarting = false;
        this.retryTimeouts.delete(timeout);
      } catch (error) {
        logger.error('Restart failed:', error);
        this.isRestarting = false;
        this.retryTimeouts.delete(timeout);
      }
    }, delay);
    
    this.retryTimeouts.add(timeout);
  }

  /**
   * Schedule reconnect with exponential backoff
   */
  async scheduleReconnect() {
    this.reconnectAttempts++;
    this.connectionMetrics.totalReconnects++;
    
    const delay = Math.min(
      config.advanced.whatsapp_reconnect_delay * Math.pow(2, this.reconnectAttempts - 1),
      60000 // Max 1 minute delay
    );
    
    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    const timeout = setTimeout(async () => {
      try {
        await this.initialize();
        this.retryTimeouts.delete(timeout);
      } catch (error) {
        logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        this.retryTimeouts.delete(timeout);
      }
    }, delay);
    
    this.retryTimeouts.add(timeout);
  }

  /**
   * Handle successful connection
   */
  async handleConnectionOpen() {
    logger.success('WhatsApp is now online and ready!');
    
    this.isConnected = true;
    this.connectionState = 'connected';
    this.reconnectAttempts = 0;
    this.qrAttempts = 0;
    this.isRestarting = false;
    this.lastConnectionTime = Date.now();

    performanceMonitor.recordEvent('whatsapp_connected', {
      reconnectAttempts: this.reconnectAttempts,
      totalAttempts: this.connectionMetrics.totalReconnects
    });

    // Notify connection handlers
    this.notifyConnectionHandlers({ connected: true });
  }

  /**
   * Handle connecting state
   */
  handleConnectionConnecting() {
    logger.info('Connecting to WhatsApp...');
    this.connectionState = 'connecting';
  }

  /**
   * Handle incoming messages with enhanced processing
   */
  async handleMessagesUpsert(m) {
    const messages = m.messages;
    
    for (const message of messages) {
      try {
        // Skip status broadcasts and own messages
        if (message.key.remoteJid === 'status@broadcast' || message.key.fromMe) {
          continue;
        }

        // Extract and validate message info
        const messageInfo = this.extractMessageInfo(message);
        
        if (messageInfo) {
          performanceMonitor.recordEvent('message_received', {
            sender: messageInfo.senderName,
            type: messageInfo.messageType,
            isGroup: messageInfo.isGroup
          });

          // Notify message handlers
          this.notifyMessageHandlers(messageInfo);
        }
        
      } catch (error) {
        logger.error('Error processing incoming message:', error);
      }
    }
  }

  /**
   * Notify message handlers safely
   */
  notifyMessageHandlers(messageInfo) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(messageInfo);
      } catch (error) {
        logger.error('Error in message handler:', error);
      }
    });
  }

  /**
   * Notify connection handlers safely
   */
  notifyConnectionHandlers(status) {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        logger.error('Error in connection handler:', error);
      }
    });
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Health check every 2 minutes
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 120000);
  }

  /**
   * Perform health check
   */
  performHealthCheck() {
    try {
      const status = this.getDetailedStatus();
      
      // Log health status if verbose logging is enabled
      if (config.debug.verbose_ai_logs) {
        logger.debug('Health Check:', {
          connected: status.connected,
          connectionState: status.connectionState,
          uptime: status.connectionUptime
        });
      }
      
      // Check for connection issues
      if (!this.isConnected && this.connectionState !== 'connecting' && !this.isRestarting) {
        logger.warn('Health check detected disconnected state, attempting recovery');
        this.scheduleReconnect();
      }
      
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Clear all retry timeouts
   */
  clearRetryTimeouts() {
    this.retryTimeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.retryTimeouts.clear();
  }

  /**
   * Update average connection duration
   */
  updateAverageConnectionDuration() {
    if (this.connectionMetrics.totalConnections > 0) {
      this.connectionMetrics.averageConnectionDuration = 
        this.connectionMetrics.connectionUptime / this.connectionMetrics.totalConnections;
    }
  }

  /**
   * Get human-readable disconnect reason
   */
  getDisconnectReason(statusCode) {
    const reasons = {
      [DisconnectReason.badSession]: 'Bad session file',
      [DisconnectReason.connectionClosed]: 'Connection closed',
      [DisconnectReason.connectionLost]: 'Connection lost',
      [DisconnectReason.connectionReplaced]: 'Connection replaced',
      [DisconnectReason.loggedOut]: 'Logged out',
      [DisconnectReason.restartRequired]: 'Restart required',
      [DisconnectReason.timedOut]: 'Connection timed out',
      [DisconnectReason.multideviceMismatch]: 'Multi-device mismatch',
      515: 'Stream error'
    };
    
    return reasons[statusCode] || `Unknown (${statusCode})`;
  }

  /**
   * Extract message information with enhanced validation
   */
  extractMessageInfo(message) {
    try {
      const messageType = Object.keys(message.message || {})[0];
      let text = '';
      let quotedMessage = null;
      
      // Extract text based on message type
      switch (messageType) {
        case 'conversation':
          text = message.message.conversation;
          break;
        case 'extendedTextMessage':
          text = message.message.extendedTextMessage.text;
          if (message.message.extendedTextMessage.contextInfo?.quotedMessage) {
            quotedMessage = this.extractQuotedMessage(message.message.extendedTextMessage.contextInfo);
          }
          break;
        case 'imageMessage':
          text = message.message.imageMessage.caption || '[Image]';
          break;
        case 'videoMessage':
          text = message.message.videoMessage.caption || '[Video]';
          break;
        case 'documentMessage':
          text = message.message.documentMessage.caption || '[Document]';
          break;
        case 'audioMessage':
          text = '[Audio]';
          break;
        case 'stickerMessage':
          text = '[Sticker]';
          break;
        default:
          text = `[${messageType || 'Unknown message type'}]`;
      }

      // Validate message content
      if (!text || text.trim().length === 0) {
        return null;
      }

      return {
        id: message.key.id,
        sender: message.key.remoteJid,
        senderName: message.pushName || 'Unknown',
        text: text.trim(),
        timestamp: message.messageTimestamp,
        messageType,
        isGroup: message.key.remoteJid.endsWith('@g.us'),
        quotedMessage: quotedMessage,
        hasQuote: !!quotedMessage,
        raw: message
      };
      
    } catch (error) {
      logger.error('Error extracting message info:', error);
      return null;
    }
  }

  /**
   * Extract quoted message information
   */
  extractQuotedMessage(contextInfo) {
    try {
      const quotedMsg = contextInfo.quotedMessage;
      const participant = contextInfo.participant;
      
      if (!quotedMsg) return null;
      
      let quotedText = '';
      const quotedType = Object.keys(quotedMsg)[0];
      
      switch (quotedType) {
        case 'conversation':
          quotedText = quotedMsg.conversation;
          break;
        case 'extendedTextMessage':
          quotedText = quotedMsg.extendedTextMessage.text;
          break;
        case 'imageMessage':
          quotedText = quotedMsg.imageMessage.caption || '[Image]';
          break;
        case 'videoMessage':
          quotedText = quotedMsg.videoMessage.caption || '[Video]';
          break;
        default:
          quotedText = `[${quotedType}]`;
      }
      
      return {
        text: quotedText,
        sender: participant,
        messageType: quotedType,
        isFromBot: participant === undefined || participant === this.sock?.user?.id
      };
    } catch (error) {
      logger.debug('Error extracting quoted message:', error);
      return null;
    }
  }

  /**
   * Send a text message with retry logic
   */
  async sendMessage(jid, text) {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp client is not connected');
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.sock.sendMessage(jid, { text });
        
        performanceMonitor.recordEvent('message_sent', {
          recipient: jid,
          length: text.length,
          attempt
        });
        
        return;
      } catch (error) {
        lastError = error;
        logger.warn(`Message send failed (attempt ${attempt + 1}/${maxRetries}):`, error.message);
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    logger.error(`Failed to send message after ${maxRetries} attempts:`, lastError);
    throw lastError;
  }

  /**
   * Send typing indicator
   */
  async sendTyping(jid, isTyping = true) {
    if (!this.isConnected || !this.sock) {
      return;
    }

    try {
      await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', jid);
    } catch (error) {
      logger.debug('Failed to send typing indicator:', error.message);
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(jid, messageId) {
    if (!this.isConnected || !this.sock) {
      return;
    }

    try {
      await this.sock.readMessages([{
        remoteJid: jid,
        id: messageId,
        participant: undefined
      }]);
    } catch (error) {
      logger.debug('Failed to mark message as read:', error.message);
    }
  }

  /**
   * Get detailed connection status
   */
  getDetailedStatus() {
    const uptime = this.lastConnectionTime ? Date.now() - this.lastConnectionTime : 0;
    
    return {
      connected: this.isConnected,
      connectionState: this.connectionState,
      hasSocket: !!this.sock,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      qrAttempts: this.qrAttempts,
      maxQrAttempts: this.maxQrAttempts,
      isRestarting: this.isRestarting,
      connectionUptime: uptime,
      metrics: this.connectionMetrics
    };
  }

  /**
   * Get connection status (legacy support)
   */
  getStatus() {
    return {
      connected: this.isConnected,
      hasSocket: !!this.sock,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      isRestarting: this.isRestarting
    };
  }

  /**
   * Register message handler
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Register connection handler
   */
  onConnection(handler) {
    this.connectionHandlers.push(handler);
  }

  /**
   * Register QR code handler
   */
  onQR(handler) {
    this.qrHandlers.push(handler);
  }

  /**
   * Gracefully disconnect
   */
  async disconnect() {
    try {
      logger.info('Initiating graceful WhatsApp disconnect...');
      
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      // Clear all retry timeouts
      this.clearRetryTimeouts();
      
      // Disconnect socket
      if (this.sock && this.isConnected) {
        await this.sock.logout();
        logger.success('WhatsApp disconnected gracefully');
      }
      
      // Reset state
      this.sock = null;
      this.isConnected = false;
      this.connectionState = 'disconnected';
      this.isRestarting = false;
      
      performanceMonitor.recordEvent('whatsapp_graceful_disconnect');
      
    } catch (error) {
      logger.warn('Force disconnect due to error:', error.message);
      this.sock = null;
      this.isConnected = false;
    }
  }
}

// Export singleton instance
export const whatsappClient = new WhatsAppClient();