const { query } = require('../database/db');

class AffiliateService {

    // Check if phone exists in affiliates OR orders
    async checkStatus(phone) {
        // 1. Check dedicated affiliates table
        const affRes = await query('SELECT name, pix_key, cep FROM affiliates WHERE phone = $1', [phone]);
        if (affRes.rows.length > 0) {
            return { found: true, source: 'affiliate', data: affRes.rows[0] };
        }

        // 2. Check orders table (historical customers)
        // Get the most recent info
        const orderRes = await query(`
            SELECT buyer_name as name, buyer_pix_key as pix_key, buyer_ref
            FROM orders 
            WHERE buyer_phone = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [phone]);

        if (orderRes.rows.length > 0) {
            const data = orderRes.rows[0];
            // Extract CEP from buyer_ref (name|phone|pix|bairro|cidade|cep)
            let cep = '';
            if (data.buyer_ref) {
                const parts = data.buyer_ref.split('|');
                if (parts.length >= 6) cep = parts[5];
            }
            return {
                found: true,
                source: 'order',
                data: { name: data.name, pix_key: data.pix_key, cep: cep }
            };
        }

        return { found: false };
    }

    // Register or Update affiliate
    async register(phone, name, pix_key, cep) {
        // Upsert
        const sql = `
            INSERT INTO affiliates (phone, name, pix_key, cep, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (phone) 
            DO UPDATE SET 
                name = EXCLUDED.name, 
                pix_key = EXCLUDED.pix_key, 
                cep = EXCLUDED.cep,
                updated_at = NOW()
            RETURNING *
        `;
        const res = await query(sql, [phone, name, pix_key, cep || null]);
        return res.rows[0];
    }
}

module.exports = new AffiliateService();
