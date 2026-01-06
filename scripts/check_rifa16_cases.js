const { query } = require('../src/database/db');

async function checkRifa16Cases() {
    try {
        console.log(`\n========================================`);
        console.log(`VERIFICANDO CASOS SUSPEITOS NA RIFA 16`);
        console.log(`========================================\n`);

        const cases = [
            { name: 'José', phone: '11965558422' },
            { name: 'Matheus', phone: '11998577859' }
        ];

        for (const c of cases) {
            console.log(`\n=== ${c.name} (${c.phone}) ===\n`);

            // All orders for this phone in Rifa 16 (draw_id = 21)
            const orders = await query(`
                SELECT status, COUNT(*) as count, MIN(created_at) as first, MAX(created_at) as last
                FROM orders
                WHERE buyer_ref LIKE $1
                AND draw_id = 21
                GROUP BY status
            `, [`%${c.phone}%`]);

            console.log('Status dos pedidos:');
            orders.rows.forEach(r => {
                console.log(`  ${r.status}: ${r.count} (${new Date(r.first).toLocaleTimeString('pt-BR')} - ${new Date(r.last).toLocaleTimeString('pt-BR')})`);
            });

            // Check how many unique numbers
            const uniqueNumbers = await query(`
                SELECT COUNT(DISTINCT number) as unique_count
                FROM orders
                WHERE buyer_ref LIKE $1
                AND draw_id = 21
            `, [`%${c.phone}%`]);

            console.log(`Números únicos tentados: ${uniqueNumbers.rows[0].unique_count}`);

            // Get details
            const details = await query(`
                SELECT DISTINCT ON (DATE_TRUNC('minute', created_at)) 
                    DATE_TRUNC('minute', created_at) as batch_time,
                    COUNT(*) OVER (PARTITION BY DATE_TRUNC('minute', created_at)) as batch_count,
                    buyer_ref
                FROM orders
                WHERE buyer_ref LIKE $1
                AND draw_id = 21
                ORDER BY DATE_TRUNC('minute', created_at) DESC
                LIMIT 5
            `, [`%${c.phone}%`]);

            console.log('\nBatches (agrupados por minuto):');
            details.rows.forEach(r => {
                const time = new Date(r.batch_time).toLocaleString('pt-BR');
                console.log(`  ${time}: ${r.batch_count} pedidos`);
            });
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

checkRifa16Cases();
