require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkCustomer() {
    try {
        const phone = '11966310671';
        console.log(`\n=== Verificando cliente: ${phone} ===\n`);

        // 1. Find customer
        const custRes = await pool.query("SELECT * FROM customers WHERE phone LIKE $1", [`%${phone}%`]);
        if (custRes.rows.length > 0) {
            console.log('👤 Cliente encontrado:', custRes.rows[0].name);
        } else {
            console.log('❌ Cliente não encontrado na tabela customers');
        }

        // 2. Find all orders with this phone in buyer_ref
        const ordersRes = await pool.query(`
            SELECT o.*, d.draw_name, d.drawn_number, d.status as draw_status
            FROM orders o
            LEFT JOIN draws d ON o.draw_id = d.id
            WHERE o.buyer_ref LIKE $1
            ORDER BY o.draw_id DESC, o.number ASC
        `, [`%${phone}%`]);

        console.log(`\n📦 Total de pedidos encontrados: ${ordersRes.rows.length}\n`);

        if (ordersRes.rows.length === 0) {
            console.log('❌ Nenhum pedido encontrado para este telefone');
            return;
        }

        // Group by draw
        const byDraw = {};
        for (const order of ordersRes.rows) {
            const drawId = order.draw_id;
            if (!byDraw[drawId]) {
                byDraw[drawId] = {
                    draw_name: order.draw_name,
                    drawn_number: order.drawn_number,
                    draw_status: order.draw_status,
                    orders: []
                };
            }
            byDraw[drawId].orders.push(order);
        }

        // Display per draw
        for (const [drawId, data] of Object.entries(byDraw)) {
            console.log(`\n🎲 ${data.draw_name} (ID: ${drawId}) - Status: ${data.draw_status}`);
            console.log(`   Número sorteado: ${data.drawn_number || 'N/A'}`);

            const paidOrders = data.orders.filter(o => o.status === 'PAID');
            const pendingOrders = data.orders.filter(o => o.status !== 'PAID');

            console.log(`   ✅ Pedidos PAGOS: ${paidOrders.length}`);
            console.log(`   ⏳ Pedidos NÃO PAGOS: ${pendingOrders.length}`);

            // List paid numbers
            const paidNumbers = paidOrders.map(o => o.number).sort((a, b) => a - b);
            console.log(`   🔢 Números PAGOS: ${paidNumbers.join(', ') || 'Nenhum'}`);

            // Check if won
            if (data.draw_status === 'CLOSED' && data.drawn_number) {
                const wonOrders = paidOrders.filter(o => o.number === data.drawn_number);
                if (wonOrders.length > 0) {
                    console.log(`   🏆 GANHOU! Tinha ${wonOrders.length} compra(s) no número ${data.drawn_number}`);
                } else {
                    console.log(`   ❌ Não ganhou. Número sorteado ${data.drawn_number} não estava nos números comprados pagos.`);
                }
            }
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

checkCustomer();
