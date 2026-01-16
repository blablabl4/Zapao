const webpush = require('web-push');
const { query } = require('../database/db');
require('dotenv').config();

// Configure VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:admin@tvzapao.com.br',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    console.warn('[NotificationService] VAPID keys missing. Push notifications disabled.');
}

class NotificationService {
    /**
     * Save/Update a push subscription for a user (or anonymous visitor)
     * @param {object} subscription - The push subscription object from browser
     * @param {string|null} userId - The logged-in user ID (optional)
     * @param {string|null} userAgent - Browser info
     */
    async subscribe(subscription, userId = null, userAgent = null) {
        // Check if endpoint exists
        const endpoint = subscription.endpoint;

        try {
            await query(`
                INSERT INTO push_subscriptions (endpoint, keys, user_id, user_agent, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                ON CONFLICT (endpoint) DO UPDATE SET
                keys = EXCLUDED.keys,
                user_id = COALESCE(EXCLUDED.user_id, push_subscriptions.user_id),
                updated_at = NOW()
            `, [
                endpoint,
                JSON.stringify(subscription.keys),
                userId,
                userAgent
            ]);

            console.log(`[Notification] Subscribed: ${userId || 'Anonymous'}`);
            return true;
        } catch (e) {
            console.error('[Notification] Subscribe error:', e);
            throw e;
        }
    }

    /**
     * Send notification to a specific user
     */
    async sendToUser(userId, payload) {
        const res = await query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
        const subs = res.rows;

        if (subs.length === 0) return { sent: 0, failed: 0 };

        let sent = 0;
        let failed = 0;

        for (const sub of subs) {
            try {
                const pushConfig = {
                    endpoint: sub.endpoint,
                    keys: JSON.parse(sub.keys)
                };
                await webpush.sendNotification(pushConfig, JSON.stringify(payload));
                sent++;
            } catch (e) {
                console.error(`[Notification] Fail user ${userId}:`, e.message);
                failed++;
                if (e.statusCode === 410 || e.statusCode === 404) {
                    // Expired subscription, remove
                    await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                }
            }
        }
        return { sent, failed };
    }

    /**
     * Send to all subscribers (Broadcast)
     */
    async broadcast(payload) {
        const res = await query('SELECT * FROM push_subscriptions');
        const subs = res.rows;
        let sent = 0;

        // Send in parallel batches
        const promises = subs.map(async sub => {
            try {
                const pushConfig = {
                    endpoint: sub.endpoint,
                    keys: JSON.parse(sub.keys)
                };
                await webpush.sendNotification(pushConfig, JSON.stringify(payload));
                sent++;
            } catch (e) {
                if (e.statusCode === 410 || e.statusCode === 404) {
                    await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                }
            }
        });

        await Promise.all(promises);
        return { total: subs.length, sent };
    }
}

module.exports = new NotificationService();
