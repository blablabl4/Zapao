const { query } = require('./src/database/db');

async function testSales() {
    console.log('--- Testing /api/admin/bolao/sales logic ---');
    try {
        console.time('Query Time');
        const result = await query(`
            SELECT 
                c.id, 
                c.payment_id, 
                c.name, 
                c.phone, 
                c.cpf, 
                c.total_qty, 
                c.round_number, 
                c.status, 
                c.claimed_at, 
                CASE WHEN c.status = 'PAID' THEN c.total_qty * 20 ELSE 0 END as total_value,
                string_agg(t.number::text, ', ') as ticket_numbers
            FROM az_claims c
            LEFT JOIN az_tickets t ON c.id = t.assigned_claim_id
            WHERE c.type = 'BOLAO'
            GROUP BY c.id
            ORDER BY 
                CASE WHEN c.status = 'PAID' THEN 1 
                     WHEN c.status = 'PENDING' THEN 2 
                     ELSE 3 
                END,
                c.claimed_at DESC
        `);
        console.timeEnd('Query Time');
        console.log(`Rows found: ${result.rows.length}`);

        if (result.rows.length > 0) {
            console.log('Sample Row:', result.rows[0]);
        }

    } catch (e) {
        console.error('ERROR:', e);
    }
}

testSales();
