const { query } = require('./src/database/db');

async function assignOrphans() {
    console.log('--- Assigning Orphans to Round 5 ---');

    // Mapping
    // "Luiz" (Lucas) -> #1
    // Others -> #2, #3, #4

    const orphans = [
        {
            id: '139445586859',
            name: 'Lucas Santos de Souza',
            phone: '11952254383',
            cpf: '70318031442',
            ticket: 1
        },
        {
            id: '139437424777', // Orphan 2
            name: 'Cliente (Recuperar MP)',
            phone: '00000000000',
            cpf: '00000000000',
            ticket: 2
        },
        {
            id: '139434567021', // Orphan 3
            name: 'Cliente (Recuperar MP)',
            phone: '00000000000',
            cpf: '00000000000',
            ticket: 3
        },
        {
            id: '139433693097', // Orphan 4
            name: 'Cliente (Recuperar MP)',
            phone: '00000000000',
            cpf: '00000000000',
            ticket: 4
        }
    ];

    try {
        const campaignId = 21;
        const round = 5;

        for (const o of orphans) {
            console.log(`\nProcessing ${o.name} -> Ticket #${o.ticket} (Round ${round})...`);

            // 1. Create Claim
            const claimSql = `
                INSERT INTO az_claims 
                (campaign_id, phone, name, cpf, round_number, base_qty, extra_qty, total_qty, type, status, payment_id, claimed_at, expires_at, next_unlock_at)
                VALUES ($1, $2, $3, $4, $5, 1, 0, 1, 'BOLAO', 'PAID', $6, NOW(), NOW() + interval '1 year', NOW())
                RETURNING id
            `;
            const claimRes = await query(claimSql, [
                campaignId,
                o.phone,
                o.name,
                o.cpf,
                round,
                o.id // Payment ID acts as key
            ]);
            const claimId = claimRes.rows[0].id;
            console.log(`   ✅ Claim Created (ID: ${claimId})`);

            // 2. Create/Assign Ticket
            // Check if ticket exists (unlikely) or insert
            const ticketCheck = await query('SELECT id FROM az_tickets WHERE campaign_id=$1 AND round_number=$2 AND number=$3', [campaignId, round, o.ticket]);

            if (ticketCheck.rows.length > 0) {
                // Update existing
                await query('UPDATE az_tickets SET status=\'ASSIGNED\', assigned_claim_id=$1 WHERE id=$2', [claimId, ticketCheck.rows[0].id]);
                console.log(`   ✅ Ticket #${o.ticket} UPDATED to ASSIGNED`);
            } else {
                // Insert new
                await query(`
                    INSERT INTO az_tickets (campaign_id, number, round_number, status, assigned_claim_id)
                    VALUES ($1, $2, $3, 'ASSIGNED', $4)
                `, [campaignId, o.ticket, round, claimId]);
                console.log(`   ✅ Ticket #${o.ticket} INSERTED as ASSIGNED`);
            }
        }

        console.log('\nSUCCESS: All 4 orphans assigned to Round 5!');

    } catch (e) {
        console.error('ERROR:', e.message);
        if (e.detail) console.error('Detail:', e.detail);
    }
}

assignOrphans();
