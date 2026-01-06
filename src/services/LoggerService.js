const { query } = require('../database/db');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Configure Winston
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'tvzapao-service' },
    transports: [
        // - Write all logs with importance level of `error` or less to `error.log`
        new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
        // - Write all logs with importance level of `info` or less to `combined.log`
        new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
    ],
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
} else {
    // In production, also log to console (stdout) for Railway to capture
    logger.add(new winston.transports.Console({
        format: winston.format.json() // JSON format for structured logs in Railway
    }));
}

class LoggerService {
    async log(level, event, message, metadata = {}) {
        try {
            // Winston Log
            const winstonLevel = level.toLowerCase() === 'warn' ? 'warn' :
                level.toLowerCase() === 'error' ? 'error' :
                    level.toLowerCase() === 'debug' ? 'debug' : 'info';

            logger.log({
                level: winstonLevel,
                message: message,
                event: event,
                ...metadata
            });

            // Database Log (Legacy/Admin Panel support)
            // We keep this to not break the Admin Panel Log View
            await query(`
                INSERT INTO az_logs (level, event, message, metadata) 
                VALUES ($1, $2, $3, $4)
            `, [level, event, message, JSON.stringify(metadata)]);
        } catch (e) {
            // If DB fails, at least Winston probably succeeded to stdout/file
            console.error('Failed to write log to DB:', e);
        }
    }

    info(event, message, metadata) { return this.log('INFO', event, message, metadata); }
    warn(event, message, metadata) { return this.log('WARN', event, message, metadata); }
    error(event, message, metadata) { return this.log('ERROR', event, message, metadata); }
    debug(event, message, metadata) { return this.log('DEBUG', event, message, metadata); }
}

module.exports = new LoggerService();
