const { query } = require('./src/database/db');

async function fixThiago() {
    const referrerId = '11947781150';
    const phone = '%96763%';

    console.log('=== Atualizando pedidos do Thiago ===\n');

    // Update orders
    const result = await query(`
        UPDATE orders 
        SET referrer_id = $1 
        WHERE buyer_ref LIKE $2 
        AND draw_id = 23 
        AND status = 'PAID'
        AND referrer_id IS NULL
        RETURNING order_id, number
    `, [referrerId, phone]);

    console.log(`✅ Atualizados: ${result.rowCount} pedidos`);
    console.log(`Números: ${result.rows.map(r => r.number).join(', ')}`);

    // Verify
    const verify = await query(`
        SELECT COUNT(*) as total, referrer_id
        FROM orders
        WHERE buyer_ref LIKE $1 AND draw_id = 23 AND status = 'PAID'
        GROUP BY referrer_id
    `, [phone]);

    console.log('\nVerificação:', verify.rows);
}

fixThiago()
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
