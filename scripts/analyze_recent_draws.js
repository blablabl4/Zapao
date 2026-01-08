require('dotenv').config();
const { query } = require('../src/database/db');

/**
 * Análise real das últimas rifas
 */
async function analyzeRecentDraws() {
    console.log('=== ANÁLISE REAL DAS ÚLTIMAS RIFAS ===\n');

    try {
        // 1. Buscar últimos 20 sorteios fechados
        const drawsResult = await query(`
            SELECT 
                id,
                draw_name,
                prize_base,
                reserve_amount,
                total_numbers,
                drawn_number,
                winners_count,
                payout_each,
                status,
                start_time,
                end_time,
                closed_at,
                created_at
            FROM draws
            WHERE status = 'CLOSED'
            ORDER BY closed_at DESC
            LIMIT 20
        `);

        if (drawsResult.rows.length === 0) {
            console.log('❌ Nenhum sorteio fechado encontrado.');
            process.exit(0);
        }

        console.log(`📊 Encontrados ${drawsResult.rows.length} sorteios fechados\n`);
        console.log('═'.repeat(100));

        let totalRevenue = 0;
        let totalPrizes = 0;
        let totalOrders = 0;
        let totalWinners = 0;

        for (const draw of drawsResult.rows) {
            console.log(`\n🎰 SORTEIO #${draw.id}: ${draw.draw_name || 'Sem nome'}`);
            console.log(`   Criado em: ${new Date(draw.created_at).toLocaleString('pt-BR')}`);
            console.log(`   Fechado em: ${new Date(draw.closed_at).toLocaleString('pt-BR')}`);

            // Buscar estatísticas de vendas deste sorteio
            const salesStats = await query(`
                SELECT 
                    COUNT(*) as total_orders,
                    COUNT(*) FILTER (WHERE status = 'PAID') as paid_orders,
                    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_orders,
                    COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired_orders,
                    COUNT(DISTINCT buyer_ref) as unique_buyers,
                    SUM(amount) FILTER (WHERE status = 'PAID') as total_revenue
                FROM orders
                WHERE draw_id = $1
            `, [draw.id]);

            const stats = salesStats.rows[0];
            const revenue = parseFloat(stats.total_revenue || 0);
            const prizeBase = parseFloat(draw.prize_base);
            const reserve = parseFloat(draw.reserve_amount || 0);
            const totalPrize = prizeBase + reserve;

            totalRevenue += revenue;
            totalPrizes += (draw.payout_each ? parseFloat(draw.payout_each) * parseInt(draw.winners_count || 0) : prizeBase);
            totalOrders += parseInt(stats.paid_orders);
            totalWinners += parseInt(draw.winners_count || 0);

            console.log(`\n   💰 FINANCEIRO:`);
            console.log(`      Prêmio Base: R$ ${prizeBase.toFixed(2)}`);
            console.log(`      Reserva: R$ ${reserve.toFixed(2)}`);
            console.log(`      Prêmio Total: R$ ${totalPrize.toFixed(2)}`);
            console.log(`      Receita (PAID): R$ ${revenue.toFixed(2)}`);

            const profit = revenue - totalPrize;
            const margin = revenue > 0 ? (profit / revenue * 100) : 0;
            console.log(`      Lucro Bruto: R$ ${profit.toFixed(2)} (${margin.toFixed(1)}%)`);

            console.log(`\n   📦 VENDAS:`);
            console.log(`      Total Pedidos: ${stats.total_orders}`);
            console.log(`      ├─ Pagos: ${stats.paid_orders}`);
            console.log(`      ├─ Pendentes: ${stats.pending_orders}`);
            console.log(`      └─ Expirados: ${stats.expired_orders}`);
            console.log(`      Compradores Únicos: ${stats.unique_buyers}`);
            console.log(`      Ticket Médio: R$ ${(revenue / parseInt(stats.paid_orders || 1)).toFixed(2)}`);

            // Número sorteado e ganhadores
            console.log(`\n   🎲 SORTEIO:`);
            console.log(`      Número Sorteado: ${draw.drawn_number !== null ? draw.drawn_number.toString().padStart(2, '0') : 'N/A'}`);
            console.log(`      Ganhadores: ${draw.winners_count || 0}`);
            console.log(`      Payout Individual: R$ ${parseFloat(draw.payout_each || 0).toFixed(2)}`);

            // Rankings de números mais vendidos neste sorteio
            const rankingResult = await query(`
                SELECT number, COUNT(*) as sales
                FROM orders
                WHERE draw_id = $1 AND status = 'PAID'
                GROUP BY number
                ORDER BY sales DESC
                LIMIT 5
            `, [draw.id]);

            if (rankingResult.rows.length > 0) {
                console.log(`\n   🏆 TOP 5 NÚMEROS MAIS VENDIDOS:`);
                rankingResult.rows.forEach((r, idx) => {
                    const wasWinner = parseInt(r.number) === draw.drawn_number ? '👑' : '  ';
                    console.log(`      ${wasWinner} #${idx + 1}: Número ${r.number.toString().padStart(2, '0')} - ${r.sales} vendas`);
                });
            }

            console.log('\n' + '─'.repeat(100));
        }

        // Resumo geral
        console.log('\n\n');
        console.log('═'.repeat(100));
        console.log('📈 RESUMO GERAL DOS ÚLTIMOS SORTEIOS');
        console.log('═'.repeat(100));
        console.log(`\n   Total de Sorteios Analisados: ${drawsResult.rows.length}`);
        console.log(`   Receita Total: R$ ${totalRevenue.toFixed(2)}`);
        console.log(`   Prêmios Pagos: R$ ${totalPrizes.toFixed(2)}`);
        console.log(`   Lucro Bruto Total: R$ ${(totalRevenue - totalPrizes).toFixed(2)}`);
        console.log(`   Margem Média: ${((totalRevenue - totalPrizes) / totalRevenue * 100).toFixed(1)}%`);
        console.log(`   Total de Pedidos Pagos: ${totalOrders}`);
        console.log(`   Total de Ganhadores: ${totalWinners}`);
        console.log(`   Ticket Médio Global: R$ ${(totalRevenue / totalOrders).toFixed(2)}`);
        console.log(`   Receita Média por Sorteio: R$ ${(totalRevenue / drawsResult.rows.length).toFixed(2)}`);

        // Análise de variação de prêmios
        const prizes = drawsResult.rows.map(d => parseFloat(d.prize_base));
        const minPrize = Math.min(...prizes);
        const maxPrize = Math.max(...prizes);
        const avgPrize = prizes.reduce((a, b) => a + b, 0) / prizes.length;

        console.log(`\n   📊 ANÁLISE DE PRÊMIOS:`);
        console.log(`      Prêmio Mínimo: R$ ${minPrize.toFixed(2)}`);
        console.log(`      Prêmio Máximo: R$ ${maxPrize.toFixed(2)}`);
        console.log(`      Prêmio Médio: R$ ${avgPrize.toFixed(2)}`);

        console.log('\n═'.repeat(100));
        console.log('\n✅ Análise concluída!\n');

        process.exit(0);

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

analyzeRecentDraws();
