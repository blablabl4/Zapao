const { query } = require('../database/db');

let intervalId = null;
let lastRun = null;

/**
 * Free expired tickets from PENDING claims
 */
async function cleanupExpiredTickets() {
    lastRun = new Date();
    try {
        // Find expired PENDING claims
        const expiredClaims = await query(`
            SELECT id, payment_id, total_qty 
            FROM az_claims 
            WHERE status = 'PENDING' 
            AND type = 'BOLAO'
            AND expires_at < NOW()
        `);

        if (expiredClaims.rows.length === 0) return;

        console.log(`[TicketCleanup] Found ${expiredClaims.rows.length} expired claims. Freeing tickets...`);

        for (const claim of expiredClaims.rows) {
            // Free tickets back to AVAILABLE
            const freedTickets = await query(`
                UPDATE az_tickets
                SET status = 'AVAILABLE', assigned_claim_id = NULL
                WHERE status = 'ASSIGNED'
                AND assigned_claim_id = $1
                RETURNING number
            `, [claim.id]);

            if (freedTickets.rows.length > 0) {
                const numbers = freedTickets.rows.map(r => r.number).sort((a, b) => a - b);
                console.log(`[TicketCleanup] ✅ Freed ${freedTickets.rows.length} tickets: ${numbers.join(', ')} (Payment ${claim.payment_id})`);
            }

            // Revert: Back to DELETE until we fix schema/constraints
            await query(`DELETE FROM az_claims WHERE id = $1`, [claim.id]);
        }

        console.log(`[TicketCleanup] ✅ Cleanup complete. ${expiredClaims.rows.length} expired claims removed.`);

    } catch (err) {
        console.error('[TicketCleanup] ❌ Error:', err.message);
    }
}

function start() {
    console.log('[TicketCleanup] 🚀 Starting ticket cleanup job (every 30s)...');
    // Run immediately once
    cleanupExpiredTickets();
    // Then every 30 seconds
    intervalId = setInterval(cleanupExpiredTickets, 30000);
}

function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        console.log('[TicketCleanup] Job stopped.');
    }
}

module.exports = { start, stop, getLastRun: () => lastRun };
