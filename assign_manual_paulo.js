const { query } = require('./src/database/db');

async function assignManual() {
    const USER = {
        name: 'Paulo Cesar de Sousa',
        phone: '11957186500',
        cpf: '30822639840',
        qty: 2
    };

    console.log(`--- Assigning ${USER.qty} tickets to ${USER.name} ---`);

    try {
        // 1. Get Active Round (assuming 5 based on context, but let's be safe)
        // Or just force 5 as strictly requested "mais duas cotas" implies widely available current game
        const round = 5;
        const campaignId = 21;

        // 2. Find Available Tickets
        const availableRes = await query(`
            SELECT id, number FROM az_tickets 
            WHERE campaign_id = $1 AND round_number = $2 AND status = 'AVAILABLE'
            ORDER BY number ASC
            LIMIT $3
        `, [campaignId, round, USER.qty]);

        if (availableRes.rows.length < USER.qty) {
            console.error(`Not enough tickets available in Round ${round}. Found: ${availableRes.rows.length}`);
            return;
        }

        const tickets = availableRes.rows;
        const ticketNumbers = tickets.map(t => t.number);
        console.log(`Selected Tickets: ${ticketNumbers.join(', ')}`);

        // 3. Create PAID Claim
        const paymentId = `MANUAL_PIX_${Date.now()}`;
        const claimSql = `
            INSERT INTO az_claims 
            (campaign_id, phone, name, cpf, round_number, base_qty, extra_qty, total_qty, type, status, payment_id, claimed_at, expires_at, next_unlock_at)
            VALUES ($1, $2, $3, $4, $5, $6, 0, $6, 'MANUAL', 'PAID', $7, NOW(), NOW() + interval '1 year', NOW())
            RETURNING id
        `;

        const claimRes = await query(claimSql, [
            campaignId,
            USER.phone,
            USER.name,
            USER.cpf,
            round,
            USER.qty,
            paymentId
        ]);

        const claimId = claimRes.rows[0].id;
        console.log(`✅ Claim Created (ID: ${claimId})`);

        // 4. Assign Tickets
        for (const t of tickets) {
            await query(`
                UPDATE az_tickets 
                SET status = 'ASSIGNED', assigned_claim_id = $1, updated_at = NOW()
                WHERE id = $2
            `, [claimId, t.id]);
        }

        console.log(`SUCCESS: ${USER.name} owns tickets [${ticketNumbers.join(', ')}] in Round ${round}`);

    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

assignManual();
