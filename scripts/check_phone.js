const { query } = require('../src/database/db');

async function checkPhone() {
    const phone = '11994956692';

    try {
        console.log(`\n=== PEDIDOS PARA ${phone} ===\n`);

        // Search for orders with this phone
        const res = await query(`
            SELECT o.*, d.draw_name 
            FROM orders o 
            LEFT JOIN draws d ON o.draw_id = d.id 
            WHERE o.buyer_ref LIKE $1
            ORDER BY o.created_at DESC
        `, [`%${phone}%`]);

        if (res.rows.length === 0) {
            console.log('Nenhum pedido encontrado para este telefone.');

            // Try partial match
            const partial = phone.substring(2); // Remove DDD
            const partialRes = await query(`
                SELECT o.*, d.draw_name 
                FROM orders o 
                LEFT JOIN draws d ON o.draw_id = d.id 
                WHERE o.buyer_ref LIKE $1
                ORDER BY o.created_at DESC
                LIMIT 10
            `, [`%${partial}%`]);

            if (partialRes.rows.length > 0) {
                console.log(`\nEncontrado ${partialRes.rows.length} resultados com busca parcial (${partial}):`);
                partialRes.rows.forEach(r => {
                    console.log(`  Rifa: ${r.draw_name || r.draw_id}, Num: ${r.number}, Status: ${r.status}`);
                });
            }
        } else {
            console.log(`Encontrados ${res.rows.length} pedidos:\n`);
            res.rows.forEach(r => {
                console.log(`ID: ${r.order_id}`);
                console.log(`Rifa: ${r.draw_name || r.draw_id}`);
                console.log(`Número: ${r.number}`);
                console.log(`Valor: R$ ${parseFloat(r.amount || 0).toFixed(2)}`);
                console.log(`Status: ${r.status}`);
                console.log(`Criado: ${r.created_at}`);
                console.log(`Buyer Ref: ${r.buyer_ref}`);
                console.log('---');
            });
        }

        // Summary counts
        console.log('\n=== RESUMO POR STATUS ===');
        const summary = await query(`
            SELECT status, COUNT(*) as count 
            FROM orders 
            WHERE buyer_ref LIKE $1
            GROUP BY status
        `, [`%${phone}%`]);

        summary.rows.forEach(r => {
            console.log(`${r.status}: ${r.count}`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

checkPhone();
