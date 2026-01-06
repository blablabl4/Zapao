const { query } = require('../src/database/db');

async function listAllDraws() {
    try {
        // List all draws
        const draws = await query(`
            SELECT id, draw_name, status, created_at 
            FROM draws 
            ORDER BY id
        `);

        console.log('=== TODAS AS RIFAS ===');
        draws.rows.forEach(d => {
            console.log(`ID: ${d.id} | Nome: ${d.draw_name} | Status: ${d.status}`);
        });

        // Now get revenue for all draws
        console.log('\n=== FATURAMENTO POR RIFA ===');
        const revenue = await query(`
            SELECT 
                d.id, 
                d.draw_name, 
                COUNT(*) as total_tickets, 
                SUM(o.amount) as total_revenue 
            FROM orders o 
            JOIN draws d ON o.draw_id = d.id 
            WHERE o.status = 'PAID' 
            GROUP BY d.id, d.draw_name
            ORDER BY d.id
        `);

        revenue.rows.forEach(r => {
            console.log(`ID: ${r.id} | ${r.draw_name} | Tickets: ${r.total_tickets} | Faturamento: R$ ${parseFloat(r.total_revenue).toFixed(2)}`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

listAllDraws();
