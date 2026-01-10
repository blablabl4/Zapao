const { query } = require('./src/database/db');

async function checkCustomer() {
    const result = await query(`
        SELECT order_id, number, status, referrer_id, draw_id, created_at
        FROM orders
        WHERE buyer_ref ILIKE '%Thiago%Jesus%Silva%'
        ORDER BY created_at DESC
        LIMIT 10
    `);

    console.log('Compras de Thiago De Jesus Silva:\n');

    if (result.rows.length === 0) {
        console.log('❌ Nenhuma compra encontrada');
        return;
    }

    result.rows.forEach(row => {
        console.log(`Nº: ${row.number} | Status: ${row.status} | Rifa: ${row.draw_id}`);
        if (row.referrer_id) {
            console.log(`  📌 AFILIADO: ${row.referrer_id}`);
        } else {
            console.log(`  ❌ Sem afiliado (compra direta)`);
        }
    });
}

checkCustomer()
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
