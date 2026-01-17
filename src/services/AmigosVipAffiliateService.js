const { query } = require('../database/db');

class AmigosVipAffiliateService {

    /**
     * Check if user is an affiliate
     * @param {string} phone
     * @returns {object} status
     */
    async checkStatus(phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        const res = await query('SELECT * FROM az_vip_affiliates WHERE phone = $1', [cleanPhone]);

        if (res.rows.length > 0) {
            return { is_affiliate: true, data: res.rows[0] };
        }
        return { is_affiliate: false };
    }

    /**
     * Register new affiliate
     * @param {string} phone 
     * @param {string} name 
     * @param {string} pixKey 
     * @param {string} zipCode 
     * @param {string|null} parentPhone - Phone of the referrer (optional)
     */
    async register(phone, name, pixKey, zipCode, parentPhone = null) {
        const cleanPhone = phone.replace(/\D/g, '');

        let parentId = null;
        if (parentPhone) {
            const cleanParent = parentPhone.replace(/\D/g, '');
            const parentRes = await query('SELECT id FROM az_vip_affiliates WHERE phone = $1', [cleanParent]);
            if (parentRes.rows.length > 0) {
                parentId = parentRes.rows[0].id;
            }
        }

        const sql = `
            INSERT INTO az_vip_affiliates (phone, name, pix_key, zip_code, parent_id, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (phone) 
            DO UPDATE SET 
                name = EXCLUDED.name, 
                pix_key = EXCLUDED.pix_key, 
                zip_code = EXCLUDED.zip_code,
                updated_at = NOW()
            RETURNING *
        `;

        const res = await query(sql, [cleanPhone, name, pixKey, zipCode, parentId]);
        return res.rows[0];
    }

    /**
     * Get Stats for Affiliate Dashboard
     * @param {string} phone 
     */
    async getStats(phone) {
        const cleanPhone = phone.replace(/\D/g, '');

        // Get ID first
        const affRes = await query('SELECT id FROM az_vip_affiliates WHERE phone = $1', [cleanPhone]);
        if (affRes.rows.length === 0) return null;
        const affiliateId = affRes.rows[0].id;

        // Sales Stats
        const salesRes = await query(`
            SELECT 
                COUNT(*) as sales_count,
                COALESCE(SUM(amount), 0) as total_revenue,
                COALESCE(SUM(qty), 0) as tickets_sold
            FROM az_vip_purchases 
            WHERE affiliate_id = $1 AND status = 'PAID'
        `, [affiliateId]);

        // Sub-affiliate Stats (Level 2)
        // Count sub-affiliates
        const subsRes = await query(`
            SELECT COUNT(*) as count FROM az_vip_affiliates WHERE parent_id = $1
        `, [affiliateId]);

        return {
            ...salesRes.rows[0],
            sub_affiliates: parseInt(subsRes.rows[0].count)
        };
    }
}

module.exports = new AmigosVipAffiliateService();
