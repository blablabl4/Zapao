const { query, getClient } = require('../database/db');
const AmigosService = require('./AmigosService');

class AmigosAdminService {
    async updateCampaign(id, data) {
        // Build query dynamically based on provided fields
        const fields = [];
        const values = [];
        let idx = 1;

        if (data.name) { fields.push(`name = $${idx++}`); values.push(data.name); }
        if (data.start_number !== undefined) { fields.push(`start_number = $${idx++}`); values.push(data.start_number); }
        if (data.end_number !== undefined) { fields.push(`end_number = $${idx++}`); values.push(data.end_number); }
        if (data.base_qty_config) { fields.push(`base_qty_config = $${idx++}`); values.push(data.base_qty_config); }
        if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }

        values.push(id);
        const res = await query(`
            UPDATE az_campaigns 
            SET ${fields.join(', ')}
            WHERE id = $${idx}
            RETURNING *
        `, values);
        return res.rows[0];
    }

    async createCampaign(data) {
        const res = await query(`
            INSERT INTO az_campaigns (name, start_number, end_number, base_qty_config, is_active)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [data.name, data.start_number, data.end_number, data.base_qty_config, data.is_active !== undefined ? data.is_active : true]);
        return res.rows[0];
    }

    async createPromotion(campaignId, data) {
        const startsAt = data.starts_at || new Date();
        const endsAt = data.ends_at || new Date('2099-12-31');
        const extraQty = parseInt(data.extra_qty) || 0;

        const res = await query(`
            INSERT INTO az_promotions (campaign_id, name, extra_qty, starts_at, ends_at, image_url, share_text, sponsor_link)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [campaignId, data.name, extraQty, startsAt, endsAt, data.image_url, data.share_text || null, data.sponsor_link || null]);
        return res.rows[0];
    }

    async generatePromoToken(promotionId) {
        const token = require('crypto').randomBytes(16).toString('hex');

        // Get promotion to set expiry same as ends_at
        const pRes = await query('SELECT ends_at FROM az_promotions WHERE id = $1', [promotionId]);
        const promo = pRes.rows[0];

        await query(`
            INSERT INTO az_promo_tokens (token, promotion_id, expires_at)
            VALUES ($1, $2, $3)
        `, [token, promotionId, promo.ends_at]);

        return token;
    }

    async getPromotions(campaignId) {
        const res = await query(`
            SELECT p.*,
            (SELECT COUNT(*) FROM az_promo_redemptions WHERE promotion_id = p.id) as redemptions_count,
            (SELECT COUNT(*) FROM az_events WHERE promotion_id = p.id AND type = 'PROMO_VIEW') as views_count
            FROM az_promotions p 
            WHERE campaign_id = $1 
            ORDER BY created_at DESC
        `, [campaignId]);
        return res.rows;
    }

    async updatePromotion(id, data) {
        const fields = [];
        const values = [];
        let idx = 1;

        // Allow updating all promo fields
        if (data.starts_at) { fields.push(`starts_at = $${idx++}`); values.push(data.starts_at); }
        if (data.ends_at) { fields.push(`ends_at = $${idx++}`); values.push(data.ends_at); }
        if (data.image_url) { fields.push(`image_url = $${idx++}`); values.push(data.image_url); }
        if (data.extra_qty !== undefined) { fields.push(`extra_qty = $${idx++}`); values.push(data.extra_qty); }
        if (data.name) { fields.push(`name = $${idx++}`); values.push(data.name); }
        if (data.share_text !== undefined) { fields.push(`share_text = $${idx++}`); values.push(data.share_text || null); }
        if (data.sponsor_link !== undefined) { fields.push(`sponsor_link = $${idx++}`); values.push(data.sponsor_link || null); }

        if (fields.length === 0) return null;

        values.push(id);
        const res = await query(`
            UPDATE az_promotions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *
        `, values);
        return res.rows[0];
    }

    async deletePromotion(id) {
        await query('DELETE FROM az_promo_tokens WHERE promotion_id = $1', [id]);
        await query('DELETE FROM az_promo_redemptions WHERE promotion_id = $1', [id]);
        // Ideally hard delete only if no redactions, or soft delete. 
        // User asked to "Delete".
        // Constraints might fail if claims exist. 
        // We will keep claims (historical) but set promotion_id null? Or cascade?
        // Let's simply delete tokens (links stop working).
        // Actual deletion of promo row might require cleaning history.
        // For now, let's assume we just want to stop it? 
        // Or if really delete:
        try {
            await query('DELETE FROM az_promotions WHERE id = $1', [id]);
            return true;
        } catch (e) {
            // Likely FK constraint from az_claims. 
            // In that case, maybe just expire it?
            throw new Error('Não é possível excluir promoção com resgates vinculados. Tente encerrar a data.');
        }
    }

    async searchParticipant(term) {
        // Term can be phone or ticket number
        // 1. Try Ticket
        let result = {};

        if (!isNaN(term)) {
            // Probably ticket number
            const ticketRes = await query(`
                SELECT t.*, c.phone, c.name, c.claimed_at, c.type, c.promotion_id, p.name as promo_name
                FROM az_tickets t
                JOIN az_claims c ON t.assigned_claim_id = c.id
                LEFT JOIN az_promotions p ON c.promotion_id = p.id
                WHERE t.number = $1
            `, [term]);

            if (ticketRes.rows.length > 0) {
                // Found via ticket
                const row = ticketRes.rows[0];
                result.participant = {
                    phone: row.phone,
                    name: row.name
                };
                // Get all claims for this phone
                result.history = await this.getHistoryByPhone(row.phone);
                return result;
            }
        }

        // 2. Try Phone
        const claimRes = await query(`
            SELECT DISTINCT phone, name FROM az_claims WHERE phone = $1 LIMIT 1
        `, [term]);

        if (claimRes.rows.length > 0) {
            result.participant = claimRes.rows[0];
            result.history = await this.getHistoryByPhone(term);
            return result;
        }

        return null; // Not found
    }

    async getHistoryByPhone(phone) {
        // Get claims and tickets
        const claimsRes = await query(`
            SELECT c.*, p.name as promo_name,
            (SELECT json_agg(number) FROM az_tickets WHERE assigned_claim_id = c.id) as tickets
            FROM az_claims c
            LEFT JOIN az_promotions p ON c.promotion_id = p.id
            WHERE c.phone = $1
            ORDER BY c.claimed_at DESC
        `, [phone]);

        return claimsRes.rows.map(c => ({
            ...c,
            description: c.type === 'PROMO' ? `Promoção: ${c.promo_name}` : 'Resgate Diário',
            print_required: `Print do status do dia ${new Date(c.claimed_at).toLocaleDateString('pt-BR')}`
        }));
    }

    async resetTickets(campaignId) {
        // Danger zone - Reset EVERYTHING for the campaign
        const client = await require('../database/db').getClient();
        try {
            await client.query('BEGIN');

            console.log('[Reset] Starting reset for campaign:', campaignId);

            // 1. Reset ALL Tickets for this campaign - force to AVAILABLE
            const ticketsRes = await client.query(`
                UPDATE az_tickets 
                SET status = 'AVAILABLE', assigned_claim_id = NULL, updated_at = NOW() 
                WHERE campaign_id = $1
            `, [campaignId]);
            console.log('[Reset] Tickets reset:', ticketsRes.rowCount);

            // 2. Delete ALL Claims for this campaign
            const claimsRes = await client.query('DELETE FROM az_claims WHERE campaign_id = $1', [campaignId]);
            console.log('[Reset] Claims deleted:', claimsRes.rowCount);

            // 3. Delete promo redemptions for promos in this campaign
            const promoRedRes = await client.query(`
                DELETE FROM az_promo_redemptions 
                WHERE promotion_id IN (SELECT id FROM az_promotions WHERE campaign_id = $1)
            `, [campaignId]);
            console.log('[Reset] Promo redemptions deleted:', promoRedRes.rowCount);

            // 4. Delete events related to this campaign
            const eventsRes = await client.query('DELETE FROM az_events WHERE campaign_id = $1', [campaignId]);
            console.log('[Reset] Events deleted:', eventsRes.rowCount);

            await client.query('COMMIT');
            console.log('[Reset] Completed successfully');
            return { claims_deleted: claimsRes.rowCount, tickets_reset: ticketsRes.rowCount };
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('[Reset] Error:', e);
            throw e;
        } finally {
            client.release();
        }
    }

    async deleteCampaign(campaignId) {
        const client = await getClient();
        try {
            await client.query('BEGIN');
            console.log('[DeleteCampaign] Starting complete deletion for campaign:', campaignId);

            // 1. Delete events
            await client.query('DELETE FROM az_events WHERE campaign_id = $1', [campaignId]);

            // 2. Delete promo redemptions
            await client.query(`
                DELETE FROM az_promo_redemptions 
                WHERE promotion_id IN (SELECT id FROM az_promotions WHERE campaign_id = $1)
            `, [campaignId]);

            // 3. Delete promo tokens
            await client.query(`
                DELETE FROM az_promo_tokens 
                WHERE promotion_id IN (SELECT id FROM az_promotions WHERE campaign_id = $1)
            `, [campaignId]);

            // 4. Delete claims
            await client.query('DELETE FROM az_claims WHERE campaign_id = $1', [campaignId]);

            // 5. Delete tickets
            await client.query('DELETE FROM az_tickets WHERE campaign_id = $1', [campaignId]);

            // 6. Delete promotions
            await client.query('DELETE FROM az_promotions WHERE campaign_id = $1', [campaignId]);

            // 7. Finally delete the campaign
            await client.query('DELETE FROM az_campaigns WHERE id = $1', [campaignId]);

            await client.query('COMMIT');
            console.log('[DeleteCampaign] Complete deletion finished');
            return { success: true };
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('[DeleteCampaign] Error:', e);
            throw e;
        } finally {
            client.release();
        }
    }

    async getStats(period, campaignId = null) {
        // period: '24h' or '7d'
        let timeFilter, interval;
        if (period === '24h') {
            timeFilter = "NOW() - INTERVAL '24 hours'";
            interval = 'hour'; // PostgreSQL trunk
        } else {
            timeFilter = "NOW() - INTERVAL '7 days'";
            interval = 'day';
        }

        // Get active campaign if not provided
        if (!campaignId) {
            const AmigosService = require('./AmigosService');
            const campaign = await AmigosService.getActiveCampaign();
            campaignId = campaign?.id;
        }

        if (!campaignId) {
            return {
                chart: { labels: [], data: [] },
                stats: { total_numbers: 0, total_users: 0, total_promos: 0 }
            };
        }

        // 1. Chart Data
        // Group claims by interval
        const chartRes = await query(`
            SELECT 
                DATE_TRUNC($1, claimed_at) as time_bucket,
                COUNT(*) as count
            FROM az_claims
            WHERE claimed_at >= ${timeFilter} AND campaign_id = $2
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        `, [interval, campaignId]);

        // Fill gaps if needed, but for MVP simple query is fine
        // Format labels and data
        const labels = [];
        const data = [];

        chartRes.rows.forEach(r => {
            const d = new Date(r.time_bucket);
            // Format label based on interval - convert to local visual
            if (interval === 'hour') {
                labels.push(d.getHours() + 'h');
            } else {
                // Day: Show "DD/MM (Dia)"
                const dayStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                const weekDay = d.toLocaleDateString('pt-BR', { weekday: 'short' });
                labels.push(`${dayStr} (${weekDay})`);
            }
            data.push(parseInt(r.count));
        });

        // 2. Total Distributed Numbers (for this campaign)
        const totalRes = await query('SELECT COUNT(*) as c FROM az_tickets WHERE status = \'ASSIGNED\' AND campaign_id = $1', [campaignId]);

        // 3. Total Participants (Unique Phones in this campaign)
        const usersRes = await query('SELECT COUNT(DISTINCT phone) as c FROM az_claims WHERE campaign_id = $1', [campaignId]);

        // 4. Redeemed Promo Codes (Stats in this campaign)
        const promoRes = await query('SELECT COUNT(*) as c FROM az_claims WHERE type = \'PROMO\' AND campaign_id = $1', [campaignId]);

        return {
            chart: { labels, data },
            stats: {
                total_numbers: parseInt(totalRes.rows[0].c),
                total_users: parseInt(usersRes.rows[0].c),
                total_promos: parseInt(promoRes.rows[0].c)
            }
        };
    }

    async logEvent(type, data) {
        await query(`
            INSERT INTO az_events (type, promotion_id, promo_token, phone, metadata, ip, user_agent, device_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [type, data.promo_id, data.token, data.phone, data.metadata, data.ip, data.ua, data.deviceId]);
    }
}

module.exports = new AmigosAdminService();
