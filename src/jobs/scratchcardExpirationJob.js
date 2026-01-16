/**
 * Scratchcard Expiration Job
 * Runs periodically to expire scratchcards from closed draws
 */
const ScratchCardService = require('../services/ScratchCardService');

const INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes

function startScratchcardExpirationJob() {
    console.log('[ScratchExpiration] Starting expiration job (every 5 min)...');

    // Run immediately on startup
    runExpiration();

    // Then run periodically
    setInterval(runExpiration, INTERVAL_MS);
}

async function runExpiration() {
    try {
        const expired = await ScratchCardService.expireForClosedDraws();
        if (expired > 0) {
            console.log(`[ScratchExpiration] Expired ${expired} cards`);
        }
    } catch (e) {
        console.error('[ScratchExpiration] Error:', e.message);
    }
}

module.exports = { startScratchcardExpirationJob };
