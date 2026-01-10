const { query } = require('./src/database/db');

async function checkPhone() {
    const phone = '96763';

    const result = await query(`
        SELECT COUNT(*) as total, referrer_id, buyer_ref
        FROM orders
        WHERE buyer_ref LIKE $1
        AND status = 'PAID'
        AND draw_id = 23
        GROUP BY referrer_id, buyer_ref
    `, [`%${phone}%`]);

    console.log(`Compras do telefone ${phone}:\n`);

    result.rows.forEach(row => {
        console.log(`Total: ${row.total} números`);
        console.log(`Cliente: ${row.buyer_ref}`);
        if (row.referrer_id) {
            console.log(`📌 AFILIADO: ${row.referrer_id}`);
        } else {
            console.log(`❌ Sem afiliado (compra direta)`);
        }
        console.log('---');
    });
}

checkPhone()
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
