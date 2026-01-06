const { query } = require('../database/db');
const { MercadoPagoConfig, Payment } = require('mercadopago');

// Initialize MP Client
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' });

let intervalId = null;
let lastRun = null;

/**
 * Check pending Bolão payments and confirm if paid
 */
async function checkPendingPayments() {
    lastRun = new Date();
    try {
        // Get pending claims from last 2 hours
        const res = await query(`
            SELECT id, payment_id, campaign_id, phone, name
            FROM az_claims 
            WHERE status = 'PENDING' 
            AND type = 'BOLAO'
            AND claimed_at > NOW() - INTERVAL '2 hours'
            ORDER BY claimed_at DESC
            LIMIT 50
        `);

        if (res.rows.length === 0) {
            console.log('[PaymentPolling] No pending payments found.');
            return;
        }

        console.log(`[PaymentPolling] Found ${res.rows.length} pending payments. Checking with MP API...`);

        const payment = new Payment(mpClient);

        for (const claim of res.rows) {
            try {
                // Payment ID must be a number for MP API
                const paymentId = parseInt(claim.payment_id);
                if (isNaN(paymentId)) {
                    console.log(`[PaymentPolling] Invalid payment_id format: ${claim.payment_id}`);
                    continue;
                }

                console.log(`[PaymentPolling] Checking payment ${paymentId} for ${claim.name}...`);

                const data = await payment.get({ id: paymentId });

                console.log(`[PaymentPolling] MP Response for ${paymentId}: status=${data.status}`);

                if (data.status === 'approved') {
                    console.log(`[PaymentPolling] ✅ Payment ${paymentId} APPROVED! Confirming claim ${claim.id}...`);

                    // Update claim to PAID
                    await query(`
                        UPDATE az_claims SET status = 'PAID' WHERE id = $1
                    `, [claim.id]);

                    console.log(`[PaymentPolling] ✅ Claim ${claim.id} (${claim.name}) confirmed!`);
                } else {
                    console.log(`[PaymentPolling] ⏳ Payment ${paymentId} status: ${data.status} (not approved yet)`);
                }
            } catch (err) {
                console.error(`[PaymentPolling] ❌ Error checking ${claim.payment_id}: ${err.message}`);
                if (err.cause) {
                    console.error(`[PaymentPolling] Cause:`, JSON.stringify(err.cause));
                }
            }
        }
    } catch (err) {
        console.error('[PaymentPolling] ❌ Fatal Error:', err.message);
    }
}

function start() {
    if (!process.env.MP_ACCESS_TOKEN) {
        console.error('[PaymentPolling] ⚠️ MP_ACCESS_TOKEN not set! Job disabled.');
        return;
    }
    console.log('[PaymentPolling] 🚀 Starting payment polling job (every 10s)...');
    // Run immediately once
    checkPendingPayments();
    // Then every 10 seconds
    intervalId = setInterval(checkPendingPayments, 10000);
}

function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        console.log('[PaymentPolling] Job stopped.');
    }
}

module.exports = { start, stop, getLastRun: () => lastRun };
