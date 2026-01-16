require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function registerSirlei() {
    try {
        const parentPhone = '11951324444'; // Eduardo
        const subName = 'Sirlei Xavier Rosa';
        const subPhone = '16982010286';
        const pixKey = '16982010286';
        const subCode = 'sirlei-rosa';

        // 1. Create customer
        let res = await pool.query("SELECT * FROM customers WHERE phone = $1", [subPhone]);
        if (res.rows.length === 0) {
            console.log(`Creating customer ${subName}...`);
            await pool.query(
                "INSERT INTO customers (phone, created_at, last_login, name, pix_key) VALUES ($1, NOW(), NOW(), $2, $3)",
                [subPhone, subName, pixKey]
            );
        } else {
            console.log(`Updating customer ${subName}...`);
            await pool.query("UPDATE customers SET name = $2, pix_key = $3 WHERE phone = $1", [subPhone, subName, pixKey]);
        }

        // 2. Create sub-affiliate
        res = await pool.query("SELECT * FROM sub_affiliates WHERE sub_phone = $1", [subPhone]);
        if (res.rows.length === 0) {
            console.log(`Creating Sub-Affiliate ${subName}...`);
            await pool.query(
                "INSERT INTO sub_affiliates (parent_phone, sub_name, sub_phone, pix_key, sub_code, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
                [parentPhone, subName, subPhone, pixKey, subCode]
            );
        } else {
            console.log(`Updating Sub-Affiliate ${subName}...`);
            await pool.query(
                "UPDATE sub_affiliates SET parent_phone=$1, sub_name=$2, pix_key=$3, sub_code=$4 WHERE sub_phone=$5",
                [parentPhone, subName, pixKey, subCode, subPhone]
            );
        }

        console.log(`\n✅ Sirlei Xavier Rosa cadastrada!`);
        console.log(`🔗 Link: https://www.tvzapao.com.br/zapao-da-sorte?ref=${subCode}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

registerSirlei();
