import chalk from 'chalk';
import gradient from 'gradient-string';

// Futuristic color schemes
const colors = {
  primary: '#00f5ff',
  secondary: '#ff006e',
  success: '#39ff14',
  warning: '#ffb700',
  error: '#ff073a',
  info: '#7c3aed',
  debug: '#06ffa5',
  trace: '#ff6b35',
  fatal: '#dc2626',
  timestamp: '#64748b',
  module: '#8b5cf6',
  text: '#e2e8f0'
};

// Gradient themes
const gradients = {
  cyber: gradient(['#00f5ff', '#ff006e']),
  neon: gradient(['#39ff14', '#ffb700']),
  plasma: gradient(['#7c3aed', '#06ffa5']),
  fire: gradient(['#ff073a', '#ff6b35'])
};

// Unicode symbols for futuristic look
const symbols = {
  info: '◉',
  warn: '⚠',
  error: '✖',
  debug: '◈',
  trace: '◇',
  fatal: '☠',
  success: '✓',
  arrow: '→',
  bullet: '•',
  diamond: '◆',
  star: '★',
  lightning: '⚡',
  rocket: '🚀',
  gear: '⚙',
  wave: '〜'
};

function formatTimestamp() {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const ms = now.getMilliseconds().toString().padStart(3, '0');
  return chalk.hex(colors.timestamp)(`${time}.${ms}`);
}

function makeLogger(prefix = '') {
  const formatMessage = (level, symbol, color, msg, args) => {
    const timestamp = formatTimestamp();
    const modulePrefix = prefix ? 
      chalk.hex(colors.module)(`[${prefix}]`) : '';
    
    const levelBadge = chalk.bgHex(color).black(` ${level.toUpperCase()} `);
    const symbolColored = chalk.hex(color)(symbol);
    const arrow = chalk.hex(colors.primary)(symbols.arrow);
    
    // Format the main message
    let formattedMsg = typeof msg === 'string' ? 
      chalk.hex(colors.text)(msg) : 
      chalk.hex(colors.text)(JSON.stringify(msg, null, 2));
    
    // Format additional arguments
    const formattedArgs = args.length > 0 ? 
      '\n' + args.map(arg => {
        if (arg instanceof Error) {
          return chalk.hex(colors.error)(`Error: ${arg.message}\nStack: ${arg.stack}`);
        }
        return typeof arg === 'object' ? 
          chalk.hex(colors.debug)(JSON.stringify(arg, null, 2)) :
          chalk.hex(colors.text)(String(arg));
      }).join(' ') : '';
    
    console.log(
      `${timestamp} ${levelBadge} ${symbolColored} ${modulePrefix} ${arrow} ${formattedMsg}${formattedArgs}`
    );
  };

  return {
    info: (msg, ...args) => {
      // Only show essential info messages
      if (typeof msg === 'string' && (
        msg.includes('📨') || 
        msg.includes('✨') || 
        msg.includes('Waiting for QR') ||
        msg.includes('online and ready') ||
        msg.includes('reconnection') ||
        msg.includes('Connection closed')
      )) {
        formatMessage('info', symbols.info, colors.info, msg, args);
      }
    },
    
    warn: (msg, ...args) => formatMessage('warn', symbols.warn, colors.warning, msg, args),
    
    error: (msg, ...args) => {
      formatMessage('error', symbols.error, colors.error, msg, args);
    },
    
    debug: (msg, ...args) => {
      if (process.env.DEBUG === 'true') {
        formatMessage('debug', symbols.debug, colors.debug, msg, args);
      }
    },
    
    trace: (msg, ...args) => {
      if (process.env.DEBUG === 'true') {
        formatMessage('trace', symbols.trace, colors.trace, msg, args);
      }
    },
    
    fatal: (msg, ...args) => {
      const fatalHeader = `${symbols.fatal} FATAL ERROR: ${msg}`;
      console.log(gradients.fire(fatalHeader));
      if (args.length > 0) {
        args.forEach(arg => {
          if (arg instanceof Error) {
            console.log(chalk.hex(colors.fatal)(`${symbols.lightning} ${arg.message}`));
            if (arg.stack) {
              console.log(chalk.hex(colors.error)(arg.stack));
            }
          } else {
            console.log(chalk.hex(colors.fatal)(typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)));
          }
        });
      }
    },
    
    success: (msg, ...args) => {
      // Only show essential success messages
      if (typeof msg === 'string' && (
        msg.includes('✨ Replied') || 
        msg.includes('WhatsApp') || 
        msg.includes('initialized') ||
        msg.includes('online and ready')
      )) {
        formatMessage('success', symbols.success, colors.success, msg, args);
      }
    },
    
    banner: (title, subtitle = '') => {
      const titleLine = `${symbols.star.repeat(3)} ${title} ${symbols.star.repeat(3)}`;
      console.log('\n' + gradients.cyber(titleLine));
      if (subtitle) {
        console.log(gradients.cyber(subtitle));
      }
      console.log('');
    },
    
    section: (title) => {
      const sectionLine = `${symbols.diamond} ${title} ${symbols.diamond}`;
      console.log('\n' + gradients.neon(sectionLine) + '\n');
    },

    silent: () => {
      // Silent logger - do nothing
    },

    // Pino-compatible child() method for Baileys
    child: (bindings = {}) => {
      const childPrefix = bindings.module || bindings.class || prefix;
      const childLogger = makeLogger(childPrefix);
      
      // Add Pino-compatible methods that Baileys expects
      childLogger.trace = childLogger.debug;
      childLogger.fatal = childLogger.fatal;
      childLogger.silent = () => {}; // Silent method
      
      return childLogger;
    },
  };
}

// Base logger
export const logger = makeLogger();

// Helper for per-module loggers
export const createModuleLogger = (module) => logger.child({ module });