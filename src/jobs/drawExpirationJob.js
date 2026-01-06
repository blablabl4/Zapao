const DrawService = require('../services/DrawService');

/**
 * Background job to auto-lock draws when they reach end_time
 * Runs every minute
 */
class DrawExpirationJob {
    constructor() {
        this.intervalMinutes = 1;
        this.intervalId = null;
        this.lastRun = null;
    }

    async run() {
        this.lastRun = new Date();
        try {
            const lockedDraws = await DrawService.checkDrawExpiration();
            if (lockedDraws.length > 0) {
                console.log(`[DrawExpirationJob] Auto-locked ${lockedDraws.length} draw(s)`);
            }
        } catch (error) {
            console.error('[DrawExpirationJob] Error:', error.message);
        }
    }

    start() {
        console.log(`[DrawExpirationJob] Starting job (runs every ${this.intervalMinutes} minute(s))`);

        // Run immediately
        this.run();

        // Then run every interval
        this.intervalId = setInterval(
            () => this.run(),
            this.intervalMinutes * 60 * 1000
        );
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[DrawExpirationJob] Job stopped');
        }
    }

    getLastRun() {
        return this.lastRun;
    }
}

module.exports = new DrawExpirationJob();
