/**
 * Remarketing Job - Automatic notification triggers
 * Runs periodically to send automated remarketing notifications
 */
const RemarketingService = require('../services/RemarketingService');
const { query } = require('../database/db');

// Tracking to avoid duplicate sends in same run
const sentThisRun = new Set();

/**
 * Main job function - runs every 15 minutes
 */
async function runRemarketingJob() {
    console.log('[Remarketing Job] Starting...');

    try {
        const raffleInfo = await RemarketingService.getCurrentRaffleInfo();

        if (!raffleInfo) {
            console.log('[Remarketing Job] No active raffle. Skipping.');
            return;
        }

        // 1. Check raffle ending soon (30min, 1h, 2h)
        await checkRaffleEnding(raffleInfo);

        // 2. Check abandoned carts (>15min unpaid)
        await checkAbandonedCarts();

        // 3. Check low ticket buyers for upsell (once per day)
        await checkLowTicketBuyers();

        console.log('[Remarketing Job] Complete.');
    } catch (e) {
        console.error('[Remarketing Job] Error:', e.message);
    }
}

/**
 * Notify users when raffle is ending soon
 */
async function checkRaffleEnding(raffle) {
    if (!raffle.end_time) return;

    const endTime = new Date(raffle.end_time);
    const now = new Date();
    const minutesLeft = Math.floor((endTime - now) / (1000 * 60));

    // Define triggers
    const triggers = [
        { minutes: 30, title: '⏰ ÚLTIMOS 30 MINUTOS!', body: `Rifa fecha em breve! Prêmio: R$ ${raffle.current_prize}` },
        { minutes: 60, title: '⏰ Falta 1 hora!', body: `Garanta seus números agora! Prêmio: R$ ${raffle.current_prize}` },
        { minutes: 120, title: '⏰ Faltam 2 horas!', body: `A rifa está encerrando! Prêmio atual: R$ ${raffle.current_prize}` }
    ];

    for (const trigger of triggers) {
        // Check if we're in the window (e.g., 30min mark = between 25-35min)
        if (minutesLeft >= trigger.minutes - 5 && minutesLeft <= trigger.minutes + 5) {
            const triggerKey = `raffle_${raffle.id}_${trigger.minutes}`;

            // Check if already sent
            const existing = await query(`
                SELECT id FROM campaigns 
                WHERE trigger_type = $1 AND created_at > NOW() - INTERVAL '1 hour'
                LIMIT 1
            `, [triggerKey]);

            if (existing.rows.length === 0) {
                console.log(`[Remarketing Job] Triggering: ${triggerKey}`);

                const campaign = await RemarketingService.createCampaign({
                    name: `Auto: Rifa Encerrando ${trigger.minutes}min`,
                    title: trigger.title,
                    body: trigger.body,
                    url: '/zapao-da-sorte',
                    segment: 'all',
                    triggerType: triggerKey,
                    createdBy: 'System'
                });

                await RemarketingService.sendCampaign(campaign.id);
            }
        }
    }
}

/**
 * Notify users with abandoned carts
 */
async function checkAbandonedCarts() {
    const carts = await RemarketingService.getAbandonedCarts(15);

    if (carts.length === 0) return;

    console.log(`[Remarketing Job] Found ${carts.length} abandoned carts`);

    // Create individual notifications for abandoned carts
    for (const cart of carts) {
        const triggerKey = `abandoned_${cart.order_id}`;

        if (sentThisRun.has(triggerKey)) continue;
        sentThisRun.add(triggerKey);

        // Check if already notified for this order
        const existing = await query(`
            SELECT id FROM campaigns 
            WHERE trigger_type = $1 
            LIMIT 1
        `, [triggerKey]);

        if (existing.rows.length === 0) {
            try {
                const webpush = require('web-push');
                const payload = {
                    title: '💳 Seu número está esperando!',
                    body: `Número ${cart.number} por R$ ${parseFloat(cart.amount).toFixed(2)} - Finalize sua compra!`,
                    icon: '/icon-192.png',
                    url: '/zapao-da-sorte'
                };

                const pushConfig = {
                    endpoint: cart.endpoint,
                    keys: typeof cart.keys === 'string' ? JSON.parse(cart.keys) : cart.keys
                };

                await webpush.sendNotification(pushConfig, JSON.stringify(payload));

                // Log as mini-campaign
                await query(`
                    INSERT INTO campaigns (name, title, body, trigger_type, status, total_sent, created_by, sent_at)
                    VALUES ($1, $2, $3, $4, 'sent', 1, 'System', NOW())
                `, [`Auto: Carrinho Abandonado ${cart.order_id}`, payload.title, payload.body, triggerKey]);

                // Update subscription
                await query(`
                    UPDATE push_subscriptions 
                    SET last_notified_at = NOW(), notifications_sent = notifications_sent + 1
                    WHERE endpoint = $1
                `, [cart.endpoint]);

            } catch (e) {
                console.error(`[Remarketing Job] Abandoned cart notification failed:`, e.message);
            }
        }
    }
}

/**
 * Notify low ticket buyers to purchase more (once daily)
 */
async function checkLowTicketBuyers() {
    const hour = new Date().getHours();

    // Only run this trigger between 18:00 and 21:00
    if (hour < 18 || hour > 21) return;

    // Check if already sent today
    const today = new Date().toISOString().split('T')[0];
    const triggerKey = `low_tickets_${today}`;

    const existing = await query(`
        SELECT id FROM campaigns 
        WHERE trigger_type = $1 
        LIMIT 1
    `, [triggerKey]);

    if (existing.rows.length > 0) return;

    const buyers = await RemarketingService.getLowTicketBuyers(5);

    if (buyers.length === 0) return;

    console.log(`[Remarketing Job] Sending upsell to ${buyers.length} low ticket buyers`);

    const campaign = await RemarketingService.createCampaign({
        name: `Auto: Upsell ${today}`,
        title: '🎯 Aumente suas chances!',
        body: 'Com 5 números suas chances aumentam 5x! Aproveite agora.',
        url: '/zapao-da-sorte',
        segment: 'low_tickets',
        triggerType: triggerKey,
        createdBy: 'System'
    });

    await RemarketingService.sendCampaign(campaign.id);
}

/**
 * Start the job interval
 */
function startRemarketingJob() {
    console.log('[Remarketing Job] Initializing...');

    // Run immediately on start
    setTimeout(() => runRemarketingJob(), 5000);

    // Then run every 15 minutes
    setInterval(runRemarketingJob, 15 * 60 * 1000);
}

module.exports = { startRemarketingJob, runRemarketingJob };
