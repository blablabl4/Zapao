const { getPool } = require('./src/database/db');

async function run() {
    const pool = getPool();
    try {
        // Find ACTIVE campaign
        const campRes = await pool.query('SELECT * FROM az_campaigns WHERE is_active = true LIMIT 1');
        let campaign = campRes.rows[0];

        if (!campaign) {
            console.log('Nenhuma campanha ativa encontrada.');
            // Fallback to ID 6 just in case
            const fallback = await pool.query('SELECT * FROM az_campaigns WHERE id = 6');
            campaign = fallback.rows[0];
            if (!campaign) return;
            console.log('Usando campanha ID 6 (Inativa) para relatório.');
        }

        console.log(`\n=== RELATÓRIO: ${campaign.name} (ID: ${campaign.id}) ===`);

        const countRes = await pool.query('SELECT COUNT(*) FROM az_tickets WHERE status = $1 AND assigned_claim_id IN (SELECT id FROM az_claims WHERE campaign_id = $2)', ['ASSIGNED', campaign.id]);

        // Correct logic: Tickets are assigned to claims. Claims belong to campaign.
        // Actually az_tickets has campaign_id too? Let's check schema/logic.
        // Based on previous files, az_tickets has campaign_id.
        const countResSimple = await pool.query('SELECT COUNT(*) FROM az_tickets WHERE status = $1 AND campaign_id = $2', ['ASSIGNED', campaign.id]);

        console.log(`TOTAL DISTRIBUÍDO: ${countResSimple.rows[0].count}`);

        console.log(`TOTAL DISTRIBUÍDO: ${countResSimple.rows[0].count}`);

        // 1. Analyze Traffic (Peaks)
        const trafficRes = await pool.query(`
            SELECT to_char(claimed_at, 'HH24:00') as hour, COUNT(*) as volume
            FROM az_claims
            WHERE campaign_id = $1
            GROUP BY 1
            ORDER BY 1
        `, [campaign.id]);

        console.log(`\n=== 📈 PICO DE TRÁFEGO (Por Hora) ===`);
        trafficRes.rows.forEach(r => {
            const bar = '█'.repeat(Math.ceil(r.volume / 2)); // Visual bar
            console.log(`${r.hour} -> ${r.volume} resgates ${bar}`);
        });

        // 2. Analyze Failures (Orphan Claims)
        const failuresRes = await pool.query(`
            SELECT c.* FROM az_claims c
            LEFT JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE c.campaign_id = $1 AND t.id IS NULL
        `, [campaign.id]);

        console.log(`\n=== ⚠️ FALHAS/ERROS (Tickets não gerados) ===`);
        if (failuresRes.rows.length === 0) {
            console.log('✅ Nenhuma falha detectada. Todos os resgates geraram tickets.');
        } else {
            console.log(`🚨 ${failuresRes.rows.length} resgates sem tickets (Possível erro no fluxo):`);
            failuresRes.rows.forEach(f => console.log(`- ${f.phone} (${f.name}) as ${f.claimed_at}`));
        }

        // 3. Current User List
        const usersRes = await pool.query(`
            SELECT c.name, c.phone, COUNT(t.id) as ticket_count,
                   STRING_AGG(t.number::text, ', ' ORDER BY t.number) as numbers
            FROM az_claims c
            JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE c.campaign_id = $1
            GROUP BY c.id, c.name, c.phone
            ORDER BY c.claimed_at DESC
            LIMIT 20
        `, [campaign.id]);

        console.log(`\n=== ÚLTIMOS 20 PARTICIPANTES (Amostra) ===`);

        usersRes.rows.forEach((u, i) => {
            console.log(`${i + 1}. ${u.name} (${u.phone}) -> ${u.ticket_count} nums: [${u.numbers}]`);
        });
        console.log('==================\n');

    } catch (e) {
        console.error('Erro detalhado:', e);
    } finally {
        // Allow time for logs to flush
        setTimeout(() => process.exit(0), 1000);
    }
}

run();
