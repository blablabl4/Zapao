const { query } = require('./src/database/db');

async function findUser() {
    console.log('--- Finding User: Matheus Marcos ---');
    try {
        // Search by Name "Matheus" + "Marcos" OR Phone ending in "98345545"
        // Handling user typo "olveira" -> matching loosely
        const sql = `
            SELECT c.id, c.name, c.phone, c.status, c.round_number, c.total_qty, c.claimed_at
            FROM az_claims c
            WHERE c.campaign_id=21
            AND (
                (c.name ILIKE '%Matheus%' AND c.name ILIKE '%Marcos%') 
                OR 
                c.phone LIKE '%98345545%'
            )
        `;
        const res = await query(sql);
        console.table(res.rows);

        if (res.rows.length > 0) {
            const user = res.rows[0];
            console.log(`\nFound: ${user.name}`);
            console.log(`Status: ${user.status}`);
            console.log(`Round (Jogo): ${user.round_number}`);

            if (user.status === 'PAID') {
                // Check Tickets
                const tix = await query("SELECT number, round_number FROM az_tickets WHERE assigned_claim_id=$1 ORDER BY number", [user.id]);
                console.log(`Tickets Assigned: ${tix.rows.map(t => `#${t.number} (R${t.round_number})`).join(', ')}`);
            }
        } else {
            console.log("User not found.");
        }

    } catch (e) {
        console.error(e);
    }
}
findUser();
