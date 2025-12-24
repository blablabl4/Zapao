const { query } = require('../database/db');
const AmigosService = require('./AmigosService');

class AmigosAdminService {
    async updateCampaign(id, data) {
        const res = await query(`
            UPDATE az_campaigns 
            SET name = $1, start_number = $2, end_number = $3, base_qty_config = $4
            WHERE id = $5
            RETURNING *
        `, [data.name, data.start_number, data.end_number, data.base_qty_config, id]);
        return res.rows[0];
    }

    async createCampaign(data) {
        const res = await query(`
            INSERT INTO az_campaigns (name, start_number, end_number, base_qty_config, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING *
        `, [data.name, data.start_number, data.end_number, data.base_qty_config]);
        return res.rows[0];
    }

    async createPromotion(campaignId, data) {
        const res = await query(`
            INSERT INTO az_promotions (campaign_id, name, extra_qty, starts_at, ends_at, image_url)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [campaignId, data.name, data.extra_qty, data.starts_at, data.ends_at, data.image_url]);
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
        const res = await query('SELECT * FROM az_promotions WHERE campaign_id = $1 ORDER BY created_at DESC', [campaignId]);
        return res.rows;
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

    async logEvent(type, data) {
        await query(`
            INSERT INTO az_events (type, promotion_id, promo_token, phone, metadata, ip, user_agent, device_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [type, data.promo_id, data.token, data.phone, data.metadata, data.ip, data.ua, data.deviceId]);
    }
}

module.exports = new AmigosAdminService();
