const { query } = require('../src/database/db');

async function checkPhoneLookup() {
    const phone = '11994956692';

    try {
        console.log(`\n=== INVESTIGANDO BUSCA POR TELEFONE ===`);
        console.log(`Telefone buscado: ${phone}\n`);

        // Query exata que o lookup usa
        const res = await query(`
            SELECT order_id, number, status, buyer_ref, draw_id
            FROM orders 
            WHERE status = 'PAID' 
            AND buyer_ref LIKE $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [`%${phone}%`]);

        console.log(`Resultados encontrados: ${res.rows.length}\n`);

        res.rows.forEach(r => {
            console.log(`Número: ${r.number}`);
            console.log(`Status: ${r.status}`);
            console.log(`Draw ID: ${r.draw_id}`);
            console.log(`Buyer Ref (truncado): ${r.buyer_ref?.substring(0, 60)}...`);
            console.log('---');
        });

        // Verificar current draw
        const draw = await query(`SELECT id, draw_name, status FROM draws WHERE status = 'ACTIVE' LIMIT 1`);
        if (draw.rows.length > 0) {
            console.log(`\nRifa Ativa: ${draw.rows[0].draw_name} (ID: ${draw.rows[0].id})`);

            // Buscar especificamente na rifa ativa
            const activeRes = await query(`
                SELECT number FROM orders
                WHERE status = 'PAID'
                AND draw_id = $1
                AND buyer_ref LIKE $2
            `, [draw.rows[0].id, `%${phone}%`]);

            console.log(`Números PAID nesta rifa para este telefone: ${activeRes.rows.length}`);
            if (activeRes.rows.length > 0) {
                console.log(`Números: ${activeRes.rows.map(r => r.number).join(', ')}`);
            }
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

checkPhoneLookup();
