require('dotenv').config();
const { query } = require('../src/database/db');

/**
 * Analisa quantas pessoas que compraram TODOS os números tiveram lucro
 */
async function analyzeBuyAllStrategy() {
    console.log('=== ANÁLISE: ESTRATÉGIA "COMPRAR TODOS" ===\n');

    try {
        // Buscar todas as rifas fechadas
        const drawsResult = await query(`
            SELECT 
                id,
                draw_name,
                total_numbers,
                prize_base,
                reserve_amount,
                drawn_number,
                winners_count,
                payout_each,
                closed_at
            FROM draws
            WHERE status = 'CLOSED'
            ORDER BY closed_at DESC
        `);

        if (drawsResult.rows.length === 0) {
            console.log('❌ Nenhuma rifa fechada encontrada.');
            process.exit(0);
        }

        console.log(`📊 Analisando ${drawsResult.rows.length} rifas fechadas...\n`);

        let totalBuyAllPlayers = 0;
        let totalProfitablePlayers = 0;
        let totalLossPlayers = 0;
        let totalBreakEvenPlayers = 0;

        const detailedResults = [];

        for (const draw of drawsResult.rows) {
            const totalNumbers = draw.total_numbers || 75; // Fallback para rifas antigas

            // Buscar quem comprou TODOS os números desta rifa
            const buyAllQuery = await query(`
                SELECT 
                    buyer_ref,
                    COUNT(DISTINCT number) as unique_numbers_bought,
                    COUNT(*) as total_purchases,
                    SUM(amount) as total_spent
                FROM orders
                WHERE draw_id = $1 
                  AND status = 'PAID'
                GROUP BY buyer_ref
                HAVING COUNT(DISTINCT number) = $2
            `, [draw.id, totalNumbers]);

            const buyAllPlayers = buyAllQuery.rows;

            if (buyAllPlayers.length === 0) continue;

            totalBuyAllPlayers += buyAllPlayers.length;

            console.log(`\n🎰 RIFA #${draw.id}: ${draw.draw_name || 'Sem nome'}`);
            console.log(`   Números totais: ${totalNumbers}`);
            console.log(`   Prêmio: R$ ${parseFloat(draw.prize_base).toFixed(2)}`);
            console.log(`   Número sorteado: ${draw.drawn_number}`);
            console.log(`   Pessoas que compraram TODOS: ${buyAllPlayers.length}`);

            for (const player of buyAllPlayers) {
                const parts = player.buyer_ref ? player.buyer_ref.split('|') : ['Desconhecido'];
                const name = parts[0] || 'Desconhecido';
                const phone = parts[1] || '';

                const totalSpent = parseFloat(player.total_spent);

                // Verificar se ganhou
                const wonQuery = await query(`
                    SELECT COUNT(*) as win_count
                    FROM orders
                    WHERE draw_id = $1
                      AND buyer_ref = $2
                      AND number = $3
                      AND status = 'PAID'
                `, [draw.id, player.buyer_ref, draw.drawn_number]);

                const won = parseInt(wonQuery.rows[0].win_count) > 0;
                const prizeReceived = won ? parseFloat(draw.payout_each || 0) : 0;
                const netProfit = prizeReceived - totalSpent;

                let status;
                if (netProfit > 0) {
                    status = '✅ LUCRO';
                    totalProfitablePlayers++;
                } else if (netProfit < 0) {
                    status = '❌ PREJUÍZO';
                    totalLossPlayers++;
                } else {
                    status = '➖ EMPATE';
                    totalBreakEvenPlayers++;
                }

                console.log(`\n   👤 ${name} (${phone})`);
                console.log(`      Gastou: R$ ${totalSpent.toFixed(2)} (${player.total_purchases} compras)`);
                console.log(`      Ganhou: ${won ? 'SIM' : 'NÃO'}`);
                console.log(`      Prêmio recebido: R$ ${prizeReceived.toFixed(2)}`);
                console.log(`      Resultado: ${status} R$ ${netProfit.toFixed(2)}`);

                detailedResults.push({
                    draw_id: draw.id,
                    draw_name: draw.draw_name,
                    player_name: name,
                    total_spent: totalSpent,
                    prize_received: prizeReceived,
                    net_profit: netProfit,
                    won
                });
            }

            console.log('   ' + '─'.repeat(70));
        }

        // Resumo geral
        console.log('\n\n');
        console.log('═'.repeat(80));
        console.log('📈 RESUMO DA ESTRATÉGIA "COMPRAR TODOS"');
        console.log('═'.repeat(80));
        console.log(`\n   Total de pessoas que compraram TODOS os números: ${totalBuyAllPlayers}`);
        console.log(`\n   ✅ Tiveram LUCRO: ${totalProfitablePlayers} (${totalBuyAllPlayers > 0 ? (totalProfitablePlayers / totalBuyAllPlayers * 100).toFixed(1) : 0}%)`);
        console.log(`   ❌ Tiveram PREJUÍZO: ${totalLossPlayers} (${totalBuyAllPlayers > 0 ? (totalLossPlayers / totalBuyAllPlayers * 100).toFixed(1) : 0}%)`);
        console.log(`   ➖ Empataram: ${totalBreakEvenPlayers} (${totalBuyAllPlayers > 0 ? (totalBreakEvenPlayers / totalBuyAllPlayers * 100).toFixed(1) : 0}%)`);

        // Análise financeira
        const totalSpentAll = detailedResults.reduce((sum, r) => sum + r.total_spent, 0);
        const totalReceivedAll = detailedResults.reduce((sum, r) => sum + r.prize_received, 0);
        const totalNetAll = totalReceivedAll - totalSpentAll;

        console.log(`\n   💰 ANÁLISE FINANCEIRA TOTAL:`);
        console.log(`      Total gasto: R$ ${totalSpentAll.toFixed(2)}`);
        console.log(`      Total recebido: R$ ${totalReceivedAll.toFixed(2)}`);
        console.log(`      Saldo líquido: R$ ${totalNetAll.toFixed(2)} (${totalNetAll >= 0 ? 'LUCRO' : 'PREJUÍZO'})`);

        const avgSpent = totalSpentAll / Math.max(totalBuyAllPlayers, 1);
        const avgReceived = totalReceivedAll / Math.max(totalBuyAllPlayers, 1);
        const avgProfit = totalNetAll / Math.max(totalBuyAllPlayers, 1);

        console.log(`\n   📊 MÉDIAS POR JOGADOR:`);
        console.log(`      Gasto médio: R$ ${avgSpent.toFixed(2)}`);
        console.log(`      Recebimento médio: R$ ${avgReceived.toFixed(2)}`);
        console.log(`      Lucro/Prejuízo médio: R$ ${avgProfit.toFixed(2)}`);

        // Probabilidade teórica vs real
        const winRate = totalBuyAllPlayers > 0 ? (totalProfitablePlayers / totalBuyAllPlayers * 100) : 0;
        console.log(`\n   🎲 TAXA DE SUCESSO:`);
        console.log(`      Teórica: 100% (comprou todos, garantiu ganhar)`);
        console.log(`      Lucro Real: ${winRate.toFixed(1)}% (nem sempre compensa)`);

        console.log('\n═'.repeat(80));
        console.log('\n✅ Análise concluída!\n');

        process.exit(0);

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

analyzeBuyAllStrategy();
