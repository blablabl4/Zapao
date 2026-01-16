require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkBalance() {
    const phone = '11951324444';
    console.log(`\n=== Verificando saldo para: ${phone} ===\n`);

    try {
        // 1. Check in customers table
        const custRes = await pool.query(
            `SELECT * FROM customers WHERE phone LIKE $1`,
            [`%${phone}%`]
        );

        if (custRes.rows.length > 0) {
            console.log('👤 Cliente encontrado:');
            console.log(custRes.rows[0]);
        } else {
            console.log('❌ Não encontrado na tabela customers');
        }

        // 2. Check in affiliates table
        const affRes = await pool.query(
            `SELECT * FROM affiliates WHERE phone LIKE $1`,
            [`%${phone}%`]
        );

        if (affRes.rows.length > 0) {
            console.log('\n🤝 Afiliado encontrado:');
            console.log(affRes.rows[0]);
        } else {
            console.log('❌ Não encontrado na tabela affiliates');
        }

        // 3. Check orders with this phone
        const ordersRes = await pool.query(`
            SELECT o.*, d.draw_name, d.status as draw_status
            FROM orders o
            LEFT JOIN draws d ON o.draw_id = d.id
            WHERE o.buyer_ref LIKE $1
            ORDER BY o.created_at DESC
            LIMIT 20
        `, [`%${phone}%`]);

        console.log(`\n📦 Pedidos encontrados: ${ordersRes.rows.length}`);
        if (ordersRes.rows.length > 0) {
            const paid = ordersRes.rows.filter(o => o.status === 'PAID').length;
            const pending = ordersRes.rows.filter(o => o.status !== 'PAID').length;
            console.log(`   ✅ Pagos: ${paid}`);
            console.log(`   ⏳ Pendentes: ${pending}`);
        }

    } catch (e) {
        console.error('Erro:', e.message);
    } finally {
        await pool.end();
    }
}

checkBalance();
