const { query } = require('../src/database/db');

async function getRifa15Stats() {
    try {
        const result = await query(`
            SELECT 
                d.id, 
                d.draw_name, 
                COUNT(*) as total_tickets, 
                SUM(o.amount) as total_revenue 
            FROM orders o 
            JOIN draws d ON o.draw_id = d.id 
            WHERE o.status = 'PAID' AND d.id = 15 
            GROUP BY d.id, d.draw_name
        `);

        console.log('=== RIFA 15 - FATURAMENTO ===');
        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log(`Draw ID: ${row.id}`);
            console.log(`Nome: ${row.draw_name}`);
            console.log(`Total de Tickets Pagos: ${row.total_tickets}`);
            console.log(`Faturamento Total: R$ ${parseFloat(row.total_revenue).toFixed(2)}`);
        } else {
            console.log('Nenhum dado encontrado para Rifa 15');
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

getRifa15Stats();
