const { query } = require('./src/database/db');

async function checkDuplicates() {
    console.log('=== VERIFICAÇÃO DE DUPLICATAS DE PAYMENT_ID ===\n');

    try {
        // 1. Check for duplicate payment_ids in entire DB
        console.log('1. VERIFICANDO DUPLICATAS NO BANCO...');
        const dupes = await query(`
            SELECT payment_id, COUNT(*) as count, 
                   array_agg(round_number) as jogos,
                   array_agg(id) as claim_ids
            FROM az_claims 
            WHERE campaign_id = 21 AND status = 'PAID' AND payment_id IS NOT NULL
            GROUP BY payment_id 
            HAVING COUNT(*) > 1
        `);

        if (dupes.rows.length > 0) {
            console.log(`⚠️ ENCONTRADAS ${dupes.rows.length} DUPLICATAS:\n`);
            dupes.rows.forEach(d => {
                console.log(`  [${d.payment_id}] aparece ${d.count}x nos jogos: ${d.jogos.join(', ')}`);
            });
        } else {
            console.log('✅ Nenhuma duplicata encontrada no banco.\n');
        }

        // 2. Get all payment_ids from DB grouped by round
        console.log('2. PAYMENT IDs POR JOGO NO BANCO...');
        const byRound = {};
        for (let r = 1; r <= 6; r++) {
            const res = await query(`
                SELECT payment_id FROM az_claims 
                WHERE campaign_id = 21 AND status = 'PAID' AND round_number = $1
            `, [r]);
            byRound[r] = res.rows.map(row => row.payment_id);
            console.log(`  Jogo ${r}: ${byRound[r].length} payment_ids`);
        }

        // 3. Check if Jogo 1 orphan IDs appear anywhere in DB
        console.log('\n3. VERIFICANDO SE ÓRFÃOS DO JOGO 1 APARECEM EM OUTROS JOGOS...');
        const orphanIds = [
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

        let foundElsewhere = [];
        for (const oid of orphanIds) {
            const found = await query(`
                SELECT id, round_number, name FROM az_claims 
                WHERE payment_id = $1
            `, [oid]);

            if (found.rows.length > 0) {
                foundElsewhere.push({
                    orphanId: oid,
                    ...found.rows[0]
                });
            }
        }

        if (foundElsewhere.length > 0) {
            console.log(`⚠️ ${foundElsewhere.length} órfãos encontrados no banco (já recuperados?):\n`);
            foundElsewhere.forEach(f => {
                console.log(`  [${f.orphanId}] → Claim #${f.id} Jogo ${f.round_number}: ${f.name}`);
            });
        } else {
            console.log('✅ Nenhum órfão do Jogo 1 aparece em outros jogos.\n');
        }

        // 4. Cross-check: does any ID from Jogo 2-6 appear in Jogo 1 period?
        console.log('\n4. VERIFICANDO SOBREPOSIÇÃO ENTRE JOGOS...');
        const allIds = new Set();
        let overlaps = [];

        for (let r = 1; r <= 6; r++) {
            for (const pid of byRound[r]) {
                if (allIds.has(pid)) {
                    overlaps.push({ pid, round: r });
                }
                allIds.add(pid);
            }
        }

        if (overlaps.length > 0) {
            console.log(`⚠️ ${overlaps.length} IDs aparecem em múltiplos jogos!`);
        } else {
            console.log('✅ Nenhum ID de pagamento se repete entre jogos.\n');
        }

        console.log('\n=== VERIFICAÇÃO COMPLETA ===');

    } catch (e) {
        console.error(e);
    }
}

checkDuplicates();
