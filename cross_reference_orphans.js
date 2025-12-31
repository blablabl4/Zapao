const { query } = require('./src/database/db');

async function crossReference() {
    console.log('=== CROSS-REFERENCE: MP Extract vs Database ===\n');

    // Orphan payment IDs from MP that are NOT in database (from earlier analysis)
    const orphanIds = [
        // Jogo 1 orphans (15:29-16:23)
        '140054102170', '140059972312', '140058131128', '139410505139', '139408853871',
        '140056224096', '139410289241', '139410451163', '140059902438', '140057329680',
        '139411892485', '140058131196', '140059026868', '139410505197', '140057329702',
        '139412442243', '139410505205', '140059664600', '139409785471', '140059736552',
        '140059026908', '140060598166', '139410992949', '139409089883', '139412026495',
        '140058307334', '139410289365', '140058741130', '140059370810', '140059026984',
        '139410505347', '140058307374', '140059144922', '140058825212', '139408798001',
        '140057329862', '139412630341', '140060024606', '140060008602', '139410505449',
        '139409489769', '140059370912', '140059552894', '140058825320', '139412630417',
        '140058611288', '140059537000', '139412442525', '139409264031', '140059972842',
        '139412630673'
    ];

    try {
        console.log('--- ORPHANS BY GAME ---\n');

        // Check each orphan ID against database
        let foundInDB = [];
        let notInDB = [];

        for (const pid of orphanIds) {
            const res = await query('SELECT id, name, round_number, status FROM az_claims WHERE payment_id = $1', [pid]);
            if (res.rows.length > 0) {
                foundInDB.push({ pid, ...res.rows[0] });
            } else {
                notInDB.push(pid);
            }
        }

        console.log(`Found in DB: ${foundInDB.length}`);
        console.log(`NOT in DB (True Orphans): ${notInDB.length}\n`);

        if (foundInDB.length > 0) {
            console.log('--- FOUND IN DB (Already Recovered) ---');
            foundInDB.forEach(f => {
                console.log(`[${f.pid}] Claim #${f.id} - ${f.name} - Jogo ${f.round_number}`);
            });
        }

        console.log('\n--- TRUE ORPHANS (Need Contact) ---');
        console.log('IDs not in database:', notInDB.join(', '));

        // Get all claims in DB grouped by round for comparison
        console.log('\n\n=== DATABASE CLAIMS BY GAME ===\n');
        for (let r = 1; r <= 6; r++) {
            const claims = await query(`
                SELECT id, payment_id, name, phone, total_qty, claimed_at
                FROM az_claims 
                WHERE campaign_id = 21 AND status = 'PAID' AND round_number = $1
                ORDER BY claimed_at
            `, [r]);

            console.log(`\nJOGO ${r}: ${claims.rows.length} claims`);

            // For Game 1, show full detail
            if (r === 1) {
                console.log('--- Detalhes Jogo 1 ---');
                claims.rows.forEach((c, i) => {
                    const dt = new Date(c.claimed_at).toLocaleString('pt-BR');
                    console.log(`${i + 1}. [${c.payment_id}] ${c.name} | Tel: ${c.phone} | Qty: ${c.total_qty} | ${dt}`);
                });
            }
        }

    } catch (e) {
        console.error(e);
    }
}
crossReference();
