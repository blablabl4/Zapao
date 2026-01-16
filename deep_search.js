require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function deepSearch() {
    try {
        const phone = '11951324444';
        console.log(`\n=== Busca Profunda: ${phone} ===\n`);

        // 1. Search as buyer
        const buyerRes = await pool.query(`
            SELECT COUNT(*) as count FROM orders WHERE buyer_ref LIKE $1
        `, [`%${phone}%`]);
        console.log(`📦 Compras como cliente: ${buyerRes.rows[0].count}`);

        // 2. Search by exact referrer_id
        const refRes = await pool.query(`
            SELECT COUNT(*) as count, SUM(amount) as total FROM orders 
            WHERE referrer_id = $1 AND status = 'PAID'
        `, [phone]);
        console.log(`🔗 Vendas com referrer_id exato: ${refRes.rows[0].count} (R$ ${parseFloat(refRes.rows[0].total || 0).toFixed(2)})`);

        // 3. Search by partial referrer_id
        const refPartialRes = await pool.query(`
            SELECT COUNT(*) as count, SUM(amount) as total FROM orders 
            WHERE referrer_id LIKE $1 AND status = 'PAID'
        `, [`%${phone}%`]);
        console.log(`🔗 Vendas com referrer_id parcial: ${refPartialRes.rows[0].count} (R$ ${parseFloat(refPartialRes.rows[0].total || 0).toFixed(2)})`);

        // 4. Check affiliates table
        const affRes = await pool.query("SELECT * FROM affiliates WHERE phone = $1", [phone]);
        if (affRes.rows.length > 0) {
            console.log(`\n👤 Afiliado encontrado: ${affRes.rows[0].name}`);
            console.log(`   Criado em: ${affRes.rows[0].created_at}`);
        }

        // 5. Check sub_affiliates he owns
        const subsRes = await pool.query("SELECT * FROM sub_affiliates WHERE parent_phone = $1", [phone]);
        console.log(`\n👥 Sub-afiliados vinculados: ${subsRes.rows.length}`);
        for (const sub of subsRes.rows) {
            console.log(`   - ${sub.sub_name} (${sub.sub_code})`);

            // Check sub sales
            const subSalesRes = await pool.query(`
                SELECT COUNT(*) as count, SUM(amount) as total 
                FROM orders WHERE referrer_id = $1 AND status = 'PAID'
            `, [sub.sub_code]);
            console.log(`     Vendas: ${subSalesRes.rows[0].count} (R$ ${parseFloat(subSalesRes.rows[0].total || 0).toFixed(2)})`);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

deepSearch();
