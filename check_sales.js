/**
 * Check affiliate/sub-affiliate sales
 */
require('dotenv').config();
const { Pool } = require('pg');

async function check() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const phone = '11951965442';

    try {
        // Check affiliates table structure first
        const cols = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'affiliates'
        `);
        console.log('Affiliates columns:', cols.rows.map(r => r.column_name).join(', '));

        // Check as sub-affiliate
        const subAffiliate = await pool.query(`
            SELECT sub_code, sub_name, parent_phone FROM sub_affiliates WHERE sub_phone = $1
        `, [phone]);

        // Check sub-affiliate orders
        const subOrders = await pool.query(`
            SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as revenue
            FROM orders o
            JOIN sub_affiliates s ON o.referrer_id = s.sub_code
            WHERE o.status = 'PAID' AND s.sub_phone = $1
        `, [phone]);

        // Check orders where referrer_id contains this phone
        const directOrders = await pool.query(`
            SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as revenue
            FROM orders
            WHERE status = 'PAID' AND referrer_id LIKE $1
        `, ['%' + phone + '%']);

        console.log('');
        console.log('📱 Telefone:', phone);
        console.log('');

        if (subAffiliate.rows.length > 0) {
            console.log('✅ É SUB-AFILIADO:', subAffiliate.rows[0].sub_name);
            console.log('   Código:', subAffiliate.rows[0].sub_code);
            console.log('   Padrinho:', subAffiliate.rows[0].parent_phone);
        } else {
            console.log('❌ Não é sub-afiliado');
        }

        const subTotal = parseInt(subOrders.rows[0].total) || 0;
        const directTotal = parseInt(directOrders.rows[0].total) || 0;

        console.log('');
        console.log('📊 Vendas:');
        console.log('   Via código sub-afiliado:', subTotal, 'tickets | R$', parseFloat(subOrders.rows[0].revenue || 0).toFixed(2));
        console.log('   Via referrer_id direto:', directTotal, 'tickets | R$', parseFloat(directOrders.rows[0].revenue || 0).toFixed(2));

    } finally {
        await pool.end();
    }
}

check();
