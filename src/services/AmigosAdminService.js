const { query } = require('../database/db');
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

        // Allow updating ends_at and image
        if (data.ends_at) { fields.push(`ends_at = $${idx++}`); values.push(data.ends_at); }
        if (data.image_url) { fields.push(`image_url = $${idx++}`); values.push(data.image_url); }
        if (data.extra_qty !== undefined) { fields.push(`extra_qty = $${idx++}`); values.push(data.extra_qty); }
        if (data.name) { fields.push(`name = $${idx++}`); values.push(data.name); }

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

    async logEvent(type, data) {
        await query(`
            INSERT INTO az_events (type, promotion_id, promo_token, phone, metadata, ip, user_agent, device_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [type, data.promo_id, data.token, data.phone, data.metadata, data.ip, data.ua, data.deviceId]);
    }
}

module.exports = new AmigosAdminService();
