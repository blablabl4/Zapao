/**
 * RemarketingService - Central service for remarketing automation
 * Handles customer segmentation, campaign triggers, and notifications
 */
const { query } = require('../database/db');
const NotificationService = require('./NotificationService');
const webpush = require('web-push');

// Configure Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const subject = process.env.VAPID_EMAIL || 'mailto:contato@zapao.com.br';
    const finalSubject = subject.startsWith('mailto:') ? subject : `mailto:${subject}`;

    webpush.setVapidDetails(
        finalSubject,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    console.warn('[Remarketing] VAPID keys not configured');
}

class RemarketingService {
    /**
     * Get customers who haven't bought in the current active raffle
     */
    async getInactiveInCurrentRaffle() {
        const result = await query(`
            WITH current_draw AS (
                SELECT id FROM draws WHERE status = 'ACTIVE' LIMIT 1
            ),
            active_buyers AS (
                SELECT DISTINCT 
                    SUBSTRING(buyer_ref FROM '[0-9]{10,11}') as phone
                FROM orders o
                JOIN current_draw cd ON o.draw_id = cd.id
                WHERE o.status = 'PAID'
            )
            SELECT DISTINCT ps.endpoint, ps.keys, ps.phone
            FROM push_subscriptions ps
            WHERE ps.phone IS NOT NULL
              AND ps.phone NOT IN (SELECT phone FROM active_buyers WHERE phone IS NOT NULL)
              AND (ps.last_notified_at IS NULL OR ps.last_notified_at < NOW() - INTERVAL '24 hours')
        `);
        return result.rows;
    }

    /**
     * Get customers with abandoned carts (orders pending for X minutes)
     */
    async getAbandonedCarts(minutesOld = 15) {
        const result = await query(`
            SELECT DISTINCT 
                o.order_id,
                o.number,
                o.amount,
                SUBSTRING(o.buyer_ref FROM '[0-9]{10,11}') as phone,
                SPLIT_PART(o.buyer_ref, '|', 1) as name,
                ps.endpoint as subscription_id,
                ps.endpoint,
                ps.keys
            FROM orders o
            JOIN push_subscriptions ps ON ps.phone = SUBSTRING(o.buyer_ref FROM '[0-9]{10,11}')
            WHERE o.status = 'PENDING'
              AND o.created_at < NOW() - INTERVAL '${minutesOld} minutes'
              AND o.created_at > NOW() - INTERVAL '2 hours'
              AND (ps.last_notified_at IS NULL OR ps.last_notified_at < NOW() - INTERVAL '30 minutes')
        `);
        return result.rows;
    }

    /**
     * Get previous winners who haven't bought in current raffle
     */
    async getPreviousWinners() {
        const result = await query(`
            WITH current_draw AS (
                SELECT id FROM draws WHERE status = 'ACTIVE' LIMIT 1
            ),
            winners AS (
                SELECT DISTINCT 
                    SUBSTRING(o.buyer_ref FROM '[0-9]{10,11}') as phone,
                    SPLIT_PART(o.buyer_ref, '|', 1) as name
                FROM orders o
                JOIN draws d ON o.draw_id = d.id
                WHERE o.status = 'PAID'
                  AND o.number = d.drawn_number
                  AND d.status = 'CLOSED'
            ),
            current_buyers AS (
                SELECT DISTINCT SUBSTRING(buyer_ref FROM '[0-9]{10,11}') as phone
                FROM orders o
                JOIN current_draw cd ON o.draw_id = cd.id
                WHERE o.status = 'PAID'
            )
            SELECT w.phone, w.name, ps.endpoint as subscription_id, ps.endpoint, ps.keys
            FROM winners w
            JOIN push_subscriptions ps ON ps.phone = w.phone
            WHERE w.phone NOT IN (SELECT phone FROM current_buyers WHERE phone IS NOT NULL)
        `);
        return result.rows;
    }

    /**
     * Get customers with low ticket count (opportunity to buy more)
     */
    async getLowTicketBuyers(maxTickets = 5) {
        const result = await query(`
            WITH current_draw AS (
                SELECT id FROM draws WHERE status = 'ACTIVE' LIMIT 1
            ),
            buyer_counts AS (
                SELECT 
                    SUBSTRING(buyer_ref FROM '[0-9]{10,11}') as phone,
                    COUNT(*) as ticket_count
                FROM orders o
                JOIN current_draw cd ON o.draw_id = cd.id
                WHERE o.status = 'PAID'
                GROUP BY SUBSTRING(buyer_ref FROM '[0-9]{10,11}')
                HAVING COUNT(*) BETWEEN 1 AND $1
            )
            SELECT bc.phone, bc.ticket_count, ps.endpoint as subscription_id, ps.endpoint, ps.keys
            FROM buyer_counts bc
            JOIN push_subscriptions ps ON ps.phone = bc.phone
            WHERE ps.last_notified_at IS NULL OR ps.last_notified_at < NOW() - INTERVAL '6 hours'
        `, [maxTickets]);
        return result.rows;
    }

    /**
     * Get all subscriptions for broadcast
     */
    async getAllSubscriptions() {
        const result = await query(`
            SELECT endpoint, keys, phone
            FROM push_subscriptions
            WHERE (last_notified_at IS NULL OR last_notified_at < NOW() - INTERVAL '1 hour')
        `);
        return result.rows;
    }

    /**
     * Get current raffle info for notification messages
     */
    async getCurrentRaffleInfo() {
        const result = await query(`
            SELECT d.*, 
                (SELECT COUNT(*) FROM orders WHERE draw_id = d.id AND status = 'PAID') as total_sold,
                (SELECT SUM(amount) FROM orders WHERE draw_id = d.id AND status = 'PAID') as total_revenue
            FROM draws d 
            WHERE status = 'ACTIVE' 
            LIMIT 1
        `);
        return result.rows[0] || null;
    }

    /**
     * Create a new campaign
     */
    async createCampaign(data) {
        const { name, title, body, url, affiliateCode, segment, triggerType, scheduledAt, createdBy } = data;

        const result = await query(`
            INSERT INTO campaigns (name, title, body, url, affiliate_code, segment, trigger_type, scheduled_at, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [name, title, body, url, affiliateCode, segment || 'all', triggerType, scheduledAt, createdBy]);

        return result.rows[0];
    }

    /**
     * Send campaign to specified segment
     */
    async sendCampaign(campaignId) {
        const campaignRes = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
        if (campaignRes.rows.length === 0) {
            throw new Error('Campaign not found');
        }

        const campaign = campaignRes.rows[0];
        let subscribers = [];

        // Get subscribers based on segment
        switch (campaign.segment) {
            case 'inactive':
                subscribers = await this.getInactiveInCurrentRaffle();
                break;
            case 'abandoned':
                subscribers = await this.getAbandonedCarts();
                break;
            case 'winners':
                subscribers = await this.getPreviousWinners();
                break;
            case 'low_tickets':
                subscribers = await this.getLowTicketBuyers();
                break;
            case 'all':
            default:
                subscribers = await this.getAllSubscriptions();
                break;
        }

        // Build URL with affiliate code if provided
        let notificationUrl = campaign.url || '/zapao-da-sorte';
        if (campaign.affiliate_code) {
            notificationUrl += (notificationUrl.includes('?') ? '&' : '?') + 'ref=' + campaign.affiliate_code;
        }

        const payload = {
            title: campaign.title,
            body: campaign.body,
            icon: campaign.icon || '/icon-192.png',
            url: notificationUrl,
            campaignId: campaign.id
        };

        let sent = 0;
        let failed = 0;

        // Send notifications
        for (const sub of subscribers) {
            try {
                const pushConfig = {
                    endpoint: sub.endpoint,
                    keys: typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys
                };

                await webpush.sendNotification(pushConfig, JSON.stringify(payload));

                // Log success
                await query(`
                    INSERT INTO notification_logs (campaign_id, subscription_id, endpoint, status)
                    VALUES ($1, $2, $3, 'sent')
                `, [campaign.id, sub.id || sub.subscription_id, sub.endpoint]);

                // Update last notified
                await query(`
                    UPDATE push_subscriptions 
                    SET last_notified_at = NOW(), notifications_sent = notifications_sent + 1
                    WHERE endpoint = $1
                `, [sub.endpoint]);

                sent++;
            } catch (e) {
                failed++;

                // Log failure
                await query(`
                    INSERT INTO notification_logs (campaign_id, subscription_id, endpoint, status, error_message)
                    VALUES ($1, $2, $3, 'failed', $4)
                `, [campaign.id, sub.id || sub.subscription_id, sub.endpoint, e.message]);

                // Remove expired subscriptions
                if (e.statusCode === 410 || e.statusCode === 404) {
                    await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                }
            }
        }

        // Update campaign stats
        await query(`
            UPDATE campaigns 
            SET status = 'sent', sent_at = NOW(), total_sent = $1, total_failed = $2
            WHERE id = $3
        `, [sent, failed, campaign.id]);

        return { campaignId: campaign.id, sent, failed, total: subscribers.length };
    }

    /**
     * Get campaign metrics
     */
    async getMetrics() {
        const stats = await query(`
            SELECT 
                (SELECT COUNT(*) FROM push_subscriptions) as total_subscribers,
                (SELECT COUNT(*) FROM campaigns WHERE status = 'sent') as campaigns_sent,
                (SELECT COALESCE(SUM(total_sent), 0) FROM campaigns) as total_notifications_sent,
                (SELECT COALESCE(SUM(total_clicked), 0) FROM campaigns) as total_clicks,
                (SELECT COUNT(*) FROM campaigns WHERE status = 'scheduled') as scheduled_campaigns
        `);
        return stats.rows[0];
    }

    /**
     * Log a notification click (called from SW)
     */
    async logClick(campaignId, endpoint) {
        await query(`
            UPDATE notification_logs 
            SET clicked_at = NOW() 
            WHERE campaign_id = $1 AND endpoint = $2
        `, [campaignId, endpoint]);

        await query(`
            UPDATE campaigns 
            SET total_clicked = total_clicked + 1 
            WHERE id = $1
        `, [campaignId]);

        await query(`
            UPDATE push_subscriptions 
            SET notifications_clicked = notifications_clicked + 1 
            WHERE endpoint = $1
        `, [endpoint]);
    }
}

module.exports = new RemarketingService();
