const { query } = require('../database/db');

class AffiliateService {

    // Check if phone exists in affiliates OR orders
    async checkStatus(phone) {
        // 1. Check dedicated affiliates table
        const affRes = await query('SELECT name, pix_key FROM affiliates WHERE phone = $1', [phone]);
        if (affRes.rows.length > 0) {
            return { found: true, source: 'affiliate', data: affRes.rows[0] };
        }

        // 2. Check orders table (historical customers)
        // Get the most recent info
        const orderRes = await query(`
            SELECT buyer_name as name, buyer_pix_key as pix_key 
            FROM orders 
            WHERE buyer_phone = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [phone]);

        if (orderRes.rows.length > 0) {
            return { found: true, source: 'order', data: orderRes.rows[0] };
        }

        return { found: false };
    }

    // Register or Update affiliate
    async register(phone, name, pix_key) {
        // Upsert
        const sql = `
            INSERT INTO affiliates (phone, name, pix_key, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (phone) 
            DO UPDATE SET name = EXCLUDED.name, pix_key = EXCLUDED.pix_key, updated_at = NOW()
            RETURNING *
        `;
        const res = await query(sql, [phone, name, pix_key]);
        return res.rows[0];
    }
}

module.exports = new AffiliateService();
