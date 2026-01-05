const { query } = require('../database/db');

class LoggerService {
    async log(level, event, message, metadata = {}) {
        try {
            console.log(`[${level}] ${event}: ${message}`, metadata);
            await query(`
                INSERT INTO az_logs (level, event, message, metadata) 
                VALUES ($1, $2, $3, $4)
            `, [level, event, message, JSON.stringify(metadata)]);
        } catch (e) {
            console.error('Failed to write log to DB:', e);
        }
    }

    info(event, message, metadata) { return this.log('INFO', event, message, metadata); }
    warn(event, message, metadata) { return this.log('WARN', event, message, metadata); }
    error(event, message, metadata) { return this.log('ERROR', event, message, metadata); }
    debug(event, message, metadata) { return this.log('DEBUG', event, message, metadata); }
}

module.exports = new LoggerService();
