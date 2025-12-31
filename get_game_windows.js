const { query } = require('./src/database/db');

async function getWindows() {
    console.log('=== JANELAS EXATAS DOS JOGOS ===\n');
    try {
        // Get rounds with started_at/completed_at
        const rounds = await query(`
            SELECT round_number, status, started_at, completed_at, total_sales
            FROM az_bolao_rounds
            WHERE campaign_id = 21
            ORDER BY round_number
        `);

        console.log('DADOS DA TABELA az_bolao_rounds:\n');
        rounds.rows.forEach(r => {
            const started = r.started_at ? new Date(r.started_at).toLocaleString('pt-BR') : 'N/A';
            const completed = r.completed_at ? new Date(r.completed_at).toLocaleString('pt-BR') : 'N/A';
            console.log(`JOGO ${r.round_number}: Status=${r.status} | Vendas=${r.total_sales}`);
            console.log(`  ABRIU: ${started}`);
            console.log(`  FECHOU: ${completed}\n`);
        });

        // Also get first/last claim times
        console.log('---\nPRIMEIRO/ÚLTIMO PAGAMENTO POR JOGO (Claims):\n');
        for (let r = 1; r <= 6; r++) {
            const data = await query(`
                SELECT 
                    MIN(claimed_at) as first_claim,
                    MAX(claimed_at) as last_claim,
                    COUNT(*) as total
                FROM az_claims 
                WHERE campaign_id = 21 AND status = 'PAID' AND round_number = $1
            `, [r]);

            if (data.rows[0].total > 0) {
                const d = data.rows[0];
                console.log(`JOGO ${r}: ${d.total} claims`);
                console.log(`  Primeiro: ${new Date(d.first_claim).toLocaleString('pt-BR')}`);
                console.log(`  Último: ${new Date(d.last_claim).toLocaleString('pt-BR')}\n`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}
getWindows();
