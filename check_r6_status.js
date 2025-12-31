const { query } = require('./src/database/db');

async function checkR6() {
    console.log('--- Checking Round 6 Status ---');
    try {
        // Count PAID quotas for round 6
        const res = await query(`
            SELECT 
                count(*) as total_claims,
                sum(total_qty) as total_cotas,
                count(*) FILTER(WHERE status = 'PAID') as paid_claims,
                sum(total_qty) FILTER(WHERE status = 'PAID') as paid_cotas
            FROM az_claims 
            WHERE campaign_id = 21 AND round_number = 6
        `);

        const stats = res.rows[0];
        console.log('Stats for Jogo 6:', stats);

        const paidCotas = parseInt(stats.paid_cotas || 0);

        if (paidCotas >= 100) {
            console.log('✅ Jogo 6 is FULLY PAID (100+ cotas).');
            console.log('Checking current status...');

            // Check current status in az_campaigns or wherever round status is stored
            // Assuming we might need to update a status field if it exists, or maybe just log it for now
            // The user said "passa ele para esgoatdo ao invez de ativo" which implies visible status update.
            // Let's check az_tickets or simple logs for "sold out" logic.

            // NOTE: The round status management might be purely count-based or in a separate config.
            // Let's check if there is a 'rounds' table or configuration.

        } else {
            console.log(`⚠️ Jogo 6 is NOT full. Paid cotas: ${paidCotas}/100`);
        }

    } catch (e) {
        console.error(e);
    }
}

checkR6();
