const { query } = require('./src/database/db');

async function investigateLucas() {
    const name = 'Lucas Santos de Souza';
    const cpf = '70318031442';
    const phone = '11952254383';
    const payId = '139445586859';

    console.log(`Investigating: ${name} | ${cpf} | ${phone} | ${payId}`);

    try {
        // 1. Search for Claims - using claimed_at instead of created_at
        const sqlClaims = `
            SELECT id, payment_id, status, total_qty, claimed_at, round_number
            FROM az_claims 
            WHERE 
                name ILIKE $1 OR 
                cpf = $2 OR 
                phone LIKE $3 OR 
                payment_id = $4
            ORDER BY claimed_at DESC
        `;

        const resClaims = await query(sqlClaims, [`%${name}%`, cpf, `%${phone}%`, payId]);

        if (resClaims.rows.length === 0) {
            console.log('No claims found for this user.');
            return;
        }

        console.log(`\nFound ${resClaims.rows.length} Claims:`);

        for (const claim of resClaims.rows) {
            console.log(`--------------------------------------------------`);
            console.log(`CLAIM ID: ${claim.id} | Status: ${claim.status} | PayID: ${claim.payment_id}`);
            console.log(`Qty: ${claim.total_qty} | Round Pref: ${claim.round_number} | Date: ${claim.claimed_at}`);

            // 2. Get Tickets for this Claim
            const sqlTickets = `
                SELECT number, round_number 
                FROM az_tickets 
                WHERE assigned_claim_id = $1
            `;
            const resTickets = await query(sqlTickets, [claim.id]);
            const tickets = resTickets.rows.map(t => `#${t.number} (R${t.round_number})`).join(', ');
            console.log(`TICKETS: ${tickets || 'None'}`);
        }

    } catch (e) {
        console.error(e);
    }
}

investigateLucas();
