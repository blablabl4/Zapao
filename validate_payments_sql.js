const { query } = require('./src/database/db');

async function validate() {
    console.log('--- FAST VALIDATION: SQL Check ---');
    try {
        const sql = `
            SELECT c.id, c.name, c.total_qty, count(t.id) as actual 
            FROM az_claims c 
            LEFT JOIN az_tickets t ON t.assigned_claim_id=c.id 
            WHERE c.campaign_id=21 AND c.status='PAID' 
            GROUP BY c.id 
            HAVING count(t.id) != c.total_qty
        `;
        const res = await query(sql);
        console.log('--- INVALID CLAIMS (Mismatch Qty) ---');
        console.table(res.rows);

        if (res.rows.length === 0) {
            console.log('✅ ALL VALID (0 Discrepancies)');
        }

        // Also check if any tickets are NOT assigned but linked to paid claim?
        // No, the join handles "assigned_claim_id".
        // But what if status is wrong?

        const sqlStatus = `
            SELECT t.id, t.status, c.id as claim_id, c.status as claim_status
            FROM az_tickets t
            JOIN az_claims c ON t.assigned_claim_id = c.id
            WHERE c.campaign_id=21 AND c.status='PAID' AND t.status != 'ASSIGNED'
        `;
        const resStatus = await query(sqlStatus);
        if (resStatus.rows.length > 0) {
            console.log('--- INVALID TICKET STATUS (Paid but not Assigned) ---');
            console.table(resStatus.rows);
        } else {
            console.log('✅ ALL TICKETS ASSIGNED OK');
        }

    } catch (e) {
        console.error(e);
    }
}
validate();
