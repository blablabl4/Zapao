const { query } = require('../database/db');

class AuthService {
    /**
     * Login or Register by Phone
     * @param {string} phone - Raw phone input
     * @returns {object} { user, isNew }
     */
    async loginByPhone(phone) {
        // Normalize: Remove non-digits
        const cleanPhone = phone.replace(/\D/g, '');

        if (cleanPhone.length < 10) {
            throw new Error('Telefone inválido (mínimo 10 dígitos)');
        }

        // 1. Try to find existing customer
        let res = await query('SELECT * FROM customers WHERE phone = $1', [cleanPhone]);

        let user = res.rows[0];
        let isNew = false;

        if (!user) {
            // 2. Register New User (Draft)
            isNew = true;
            console.log(`[AuthService] Registering new user: ${cleanPhone}`);

            try {
                res = await query(`
                    INSERT INTO customers (phone, created_at, last_login)
                    VALUES ($1, NOW(), NOW())
                    RETURNING *
                `, [cleanPhone]);
                user = res.rows[0];
            } catch (err) {
                if (err.code === '23505') { // Unique constraint violation (race condition)
                    console.log(`[AuthService] User ${cleanPhone} already exists (race condition), fetching...`);
                    res = await query('SELECT * FROM customers WHERE phone = $1', [cleanPhone]);
                    user = res.rows[0];
                    isNew = false;
                } else {
                    throw err;
                }
            }
        } else {
            // 3. Update Last Login
            await query('UPDATE customers SET last_login = NOW() WHERE id = $1', [user.id]);
        }

        return { user, isNew };
    }

    /**
     * Update User Profile (Name, PIX, etc)
     * Called usually after Checkout or Profile Edit
     */
    async updateProfile(customerId, data) {
        const updates = [];
        const values = [];
        let idx = 1;

        if (data.name) {
            updates.push(`name = $${idx++}`);
            values.push(data.name);
        }
        if (data.pix_key) {
            updates.push(`pix_key = $${idx++}`);
            values.push(data.pix_key);
        }

        if (data.birth_date) {
            updates.push(`birth_date = $${idx++}`);
            values.push(data.birth_date);
        }
        if (data.zip_code) {
            updates.push(`zip_code = $${idx++}`);
            values.push(data.zip_code);
        }

        if (updates.length === 0) return null;

        values.push(customerId);
        const q = `UPDATE customers SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;

        const res = await query(q, values);
        return res.rows[0];
    }

    /**
     * Get User by ID
     */
    async getUserById(id) {
        const res = await query('SELECT * FROM customers WHERE id = $1', [id]);
        return res.rows[0];
    }

    /**
     * Get User by Phone (for lookup/auto-fill)
     */
    async getUserByPhone(phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        const res = await query('SELECT * FROM customers WHERE phone = $1', [cleanPhone]);
        return res.rows[0];
    }

    /**
     * Check if PIX key is used by a DIFFERENT customer (fraud detection)
     * @param {string} pixKey - PIX key to check
     * @param {string} currentPhone - Current user's phone (to exclude from check)
     * @returns {boolean} true if duplicate (belongs to another account)
     */
    async isPixDuplicate(pixKey, currentPhone) {
        if (!pixKey) return false;

        const cleanPhone = currentPhone ? currentPhone.replace(/\D/g, '') : '';

        // Find any customer with this PIX key that is NOT the current user
        const res = await query(`
            SELECT id, phone FROM customers 
            WHERE pix_key = $1 AND phone != $2
            LIMIT 1
        `, [pixKey, cleanPhone]);

        if (res.rows.length > 0) {
            console.log(`[AuthService] ⚠️ PIX DUPLICATE DETECTED: ${pixKey} already belongs to phone ${res.rows[0].phone}`);
            return true;
        }
        return false;
    }
}

module.exports = new AuthService();
