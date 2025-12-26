/**
 * Structured Logger
 * Provides consistent logging format across the application
 */

const config = require('../config');

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

// Minimum log level based on environment
const MIN_LEVEL = config.IS_PRODUCTION ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

/**
 * Format log message with timestamp and metadata
 */
function formatLog(level, context, message, data = null) {
    const timestamp = new Date().toISOString();
    const base = {
        timestamp,
        level,
        context,
        message
    };

    if (data) {
        base.data = data;
    }

    return base;
}

/**
 * Output log based on environment
 * Development: Pretty printed
 * Production: JSON for log aggregation
 */
function output(level, logObj) {
    if (LOG_LEVELS[level] < MIN_LEVEL) return;

    if (config.IS_PRODUCTION) {
        // JSON for production (easy to parse by log aggregators)
        console.log(JSON.stringify(logObj));
    } else {
        // Pretty print for development
        const color = {
            DEBUG: '\x1b[36m', // Cyan
            INFO: '\x1b[32m',  // Green
            WARN: '\x1b[33m',  // Yellow
            ERROR: '\x1b[31m'  // Red
        }[level] || '\x1b[0m';

        const reset = '\x1b[0m';
        console.log(`${color}[${logObj.timestamp}] [${level}] [${logObj.context}]${reset} ${logObj.message}`, logObj.data || '');
    }
}

/**
 * Logger factory - creates logger with fixed context
 */
function createLogger(context) {
    return {
        debug: (message, data) => output('DEBUG', formatLog('DEBUG', context, message, data)),
        info: (message, data) => output('INFO', formatLog('INFO', context, message, data)),
        warn: (message, data) => output('WARN', formatLog('WARN', context, message, data)),
        error: (message, data) => output('ERROR', formatLog('ERROR', context, message, data))
    };
}

// Convenience loggers for common contexts
module.exports = {
    createLogger,
    db: createLogger('Database'),
    api: createLogger('API'),
    auth: createLogger('Auth'),
    job: createLogger('Job'),
    server: createLogger('Server')
};
