const { query } = require('../database/db');
const PaymentService = require('../services/PaymentService');

let intervalId = null;

/**
 * Webhook Retry Job
 * Picks up FAILED webhook events and retries them
 * Runs every 10 minutes
 */
async function retryFailedWebhooks() {
    try {
        console.log('[WebhookRetry] Checking for failed webhooks...');

        // Get failed events created in the last 24 hours (ignore very old ones)
        // Order by oldest first to process in sequence
        const failedEvents = await query(`
            SELECT id, raw_payload, created_at 
            FROM webhook_events 
            WHERE status = 'FAILED' 
            AND created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY created_at ASC
            LIMIT 10
        `);

        if (failedEvents.rows.length === 0) {
            return;
        }

        console.log(`[WebhookRetry] Found ${failedEvents.rows.length} failed events to retry.`);

        for (const event of failedEvents.rows) {
            try {
                const payload = event.raw_payload; // already JSON jsonb or string?
                // Check type of raw_payload
                const raw = typeof payload === 'string' ? JSON.parse(payload) : payload;

                console.log(`[WebhookRetry] Retrying event #${event.id}...`);

                // Call logic directly (bypassing hash check, as we want to force retry)
                const result = await PaymentService.processPaymentLogic(raw, event.id);

                if (result.success) {
                    console.log(`[WebhookRetry] ✅ Event #${event.id} reprocessed successfully.`);
                } else {
                    console.log(`[WebhookRetry] ❌ Event #${event.id} failed again: ${result.message}`);
                    // Maybe mark as 'PERMANENTLY_FAILED' after X retries? 
                    // For now, it stays FAILED and we pick it up again later (or limit query validation)
                }

            } catch (err) {
                console.error(`[WebhookRetry] Error processing event #${event.id}:`, err.message);
            }
        }

    } catch (err) {
        console.error('[WebhookRetry] Fatal Error:', err.message);
    }
}

function start() {
    console.log('[WebhookRetry] 🔄 Starting webhook retry job (every 10 min)...');

    // Run after 2 minutes
    setTimeout(() => {
        retryFailedWebhooks();
        // Then run every 10 minutes
        intervalId = setInterval(retryFailedWebhooks, 10 * 60 * 1000);
    }, 2 * 60 * 1000);
}

function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        console.log('[WebhookRetry] Job stopped.');
    }
}

module.exports = { start, stop };
