const OrderService = require('../services/OrderService');

/**
 * Background job to mark expired orders
 * Runs every minute
 */
class ExpirationJob {
    constructor() {
        this.intervalMinutes = 1;
        this.intervalId = null;
        this.lastRun = null;
    }

    async run() {
        this.lastRun = new Date();
        try {
            const count = await OrderService.markExpiredOrders();
            if (count > 0) {
                console.log(`[ExpirationJob] Marked ${count} order(s) as expired`);
            }
        } catch (error) {
            console.error('[ExpirationJob] Error:', error.message);
        }
    }

    start() {
        console.log(`[ExpirationJob] Starting job (runs every ${this.intervalMinutes} minute(s))`);

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
            console.log('[ExpirationJob] Job stopped');
        }
    }

    getLastRun() {
        return this.lastRun;
    }
}

module.exports = new ExpirationJob();
