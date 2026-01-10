const { query } = require('./src/database/db');

async function investigateAffiliate() {
    const affiliatePhone = '11947781150';

    console.log('=== INVESTIGAÇÃO DE AFILIADO ===\n');
    console.log(`Afiliado: ${affiliatePhone}\n`);

    // 1. Check if affiliate exists
    const affRes = await query(`
        SELECT * FROM affiliates WHERE phone = $1
    `, [affiliatePhone]);

    if (affRes.rows.length > 0) {
        console.log('✅ Afiliado cadastrado:', affRes.rows[0]);
    } else {
        console.log('❌ Afiliado NÃO cadastrado na tabela affiliates');
    }

    // 2. Check clicks for this affiliate
    const clicksRes = await query(`
        SELECT COUNT(*) as total, draw_id
        FROM affiliate_clicks
        WHERE referrer_id = $1
        GROUP BY draw_id
        ORDER BY draw_id DESC
    `, [affiliatePhone]);

    console.log('\n📊 Cliques registrados:', clicksRes.rows);

    // 3. Check orders with this referrer
    const ordersRes = await query(`
        SELECT COUNT(*) as total, status, draw_id
        FROM orders
        WHERE referrer_id = $1
        GROUP BY status, draw_id
        ORDER BY draw_id DESC
    `, [affiliatePhone]);

    console.log('\n📦 Pedidos com este referrer:', ordersRes.rows);

    // 4. Check specific phones
    console.log('\n--- Verificando telefones específicos ---\n');

    // Thiago (96763-6950)
    const thiagoRes = await query(`
        SELECT order_id, number, referrer_id, status, created_at
        FROM orders
        WHERE buyer_ref LIKE '%96763%'
        AND draw_id = 23
        ORDER BY created_at DESC
        LIMIT 3
    `);
    console.log('Thiago (96763-6950):', thiagoRes.rows.length > 0 ? thiagoRes.rows[0] : 'Não encontrado');

    // (11) 98553-8611
    const outroRes = await query(`
        SELECT order_id, number, referrer_id, status, created_at
        FROM orders
        WHERE buyer_ref LIKE '%98553%'
        AND draw_id = 23
        ORDER BY created_at DESC
        LIMIT 3
    `);
    console.log('(11) 98553-8611:', outroRes.rows.length > 0 ? outroRes.rows[0] : 'Não encontrado');

    // 5. Check all orders attributed to this affiliate
    const attrRes = await query(`
        SELECT buyer_ref, COUNT(*) as tickets, status
        FROM orders
        WHERE referrer_id = $1
        AND draw_id = 23
        GROUP BY buyer_ref, status
    `, [affiliatePhone]);

    console.log('\n✅ Clientes atribuídos ao afiliado na rifa 23:');
    attrRes.rows.forEach(row => {
        const parts = row.buyer_ref.split('|');
        console.log(`  - ${parts[0]} | ${row.tickets} tickets | ${row.status}`);
    });
}

investigateAffiliate()
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
