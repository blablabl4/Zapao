require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixAccount() {
    try {
        const pixKey = '86995862258';
        const correctPhone = '11966099687';

        console.log(`Searching for account with PIX: ${pixKey}`);

        // 1. Find the account
        const res = await pool.query("SELECT * FROM customers WHERE pix_key = $1", [pixKey]);

        if (res.rows.length === 0) {
            console.log('❌ No account found with this PIX key!');
            return;
        }

        const user = res.rows[0];
        console.log('✅ Found account:', {
            id: user.id,
            name: user.name,
            current_phone: user.phone,
            pix_key: user.pix_key
        });

        // 2. Fix the phone
        console.log(`Updating phone from ${user.phone} to ${correctPhone}...`);

        await pool.query("UPDATE customers SET phone = $1 WHERE id = $2", [correctPhone, user.id]);

        console.log('✅ Account Updated Successfully!');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

fixAccount();
