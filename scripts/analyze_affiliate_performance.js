require('dotenv').config();
const { query } = require('../src/database/db');

/**
 * Análise de performance de afiliado específico na última rifa
 */
async function analyzeAffiliatePerformance() {
    const affiliateCode = '11947781150'; // Código do afiliado

    console.log('=== ANÁLISE DE AFILIADO ===\n');
    console.log(`Afiliado: ${affiliateCode}\n`);

    try {
        // 1. Buscar última rifa (mais recente)
        const lastDrawResult = await query(`
            SELECT id, draw_name, status, closed_at, created_at
            FROM draws
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (lastDrawResult.rows.length === 0) {
            console.log('❌ Nenhuma rifa encontrada.');
            process.exit(0);
        }

        const lastDraw = lastDrawResult.rows[0];
        console.log(`📊 ÚLTIMA RIFA:`);
        console.log(`   ID: ${lastDraw.id}`);
        console.log(`   Nome: ${lastDraw.draw_name || 'Sem nome'}`);
        console.log(`   Status: ${lastDraw.status}`);
        console.log(`   Criada em: ${new Date(lastDraw.created_at).toLocaleString('pt-BR')}`);
        if (lastDraw.closed_at) {
            console.log(`   Fechada em: ${new Date(lastDraw.closed_at).toLocaleString('pt-BR')}`);
        }
        console.log('');

        // 2. Buscar performance do afiliado nessa rifa
        const affiliateStats = await query(`
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(*) FILTER (WHERE status = 'PAID') as paid_tickets,
                COUNT(*) FILTER (WHERE status = 'PENDING') as pending_tickets,
                COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired_tickets,
                COUNT(DISTINCT buyer_ref) FILTER (WHERE status = 'PAID') as unique_customers,
                SUM(amount) FILTER (WHERE status = 'PAID') as total_revenue,
                SUM(amount) as total_potential_revenue
            FROM orders
            WHERE draw_id = $1 
              AND referrer_id = $2
        `, [lastDraw.id, affiliateCode]);

        const stats = affiliateStats.rows[0];

        console.log(`💰 PERFORMANCE DO AFILIADO: ${affiliateCode}`);
        console.log('');

        // Tickets
        console.log(`📝 TICKETS:`);
        console.log(`   Total de Tickets: ${stats.total_tickets}`);
        console.log(`   ├─ Pagos: ${stats.paid_tickets}`);
        console.log(`   ├─ Pendentes: ${stats.pending_tickets}`);
        console.log(`   └─ Expirados: ${stats.expired_tickets}`);
        console.log('');

        // Clientes
        console.log(`👥 CLIENTES:`);
        console.log(`   Clientes Únicos (PAGOS): ${stats.unique_customers}`);
        const avgTicketsPerClient = parseInt(stats.paid_tickets) / Math.max(parseInt(stats.unique_customers), 1);
        console.log(`   Média de Tickets/Cliente: ${avgTicketsPerClient.toFixed(2)}`);
        console.log('');

        // Faturamento
        const revenue = parseFloat(stats.total_revenue || 0);
        const potentialRevenue = parseFloat(stats.total_potential_revenue || 0);

        console.log(`💵 FATURAMENTO:`);
        console.log(`   Faturado (PAID): R$ ${revenue.toFixed(2)}`);
        console.log(`   Potencial (Total): R$ ${potentialRevenue.toFixed(2)}`);
        console.log(`   Ticket Médio: R$ ${(revenue / Math.max(parseInt(stats.paid_tickets), 1)).toFixed(2)}`);
        console.log('');

        // Taxa de conversão
        const conversionRate = parseInt(stats.total_tickets) > 0
            ? (parseInt(stats.paid_tickets) / parseInt(stats.total_tickets) * 100)
            : 0;
        console.log(`📈 CONVERSÃO:`);
        console.log(`   Taxa de Pagamento: ${conversionRate.toFixed(1)}%`);
        console.log('');

        // Lista de clientes (top 10)
        const customersResult = await query(`
            SELECT 
                buyer_ref,
                COUNT(*) as tickets,
                SUM(amount) as amount
            FROM orders
            WHERE draw_id = $1 
              AND referrer_id = $2
              AND status = 'PAID'
            GROUP BY buyer_ref
            ORDER BY tickets DESC
            LIMIT 10
        `, [lastDraw.id, affiliateCode]);

        if (customersResult.rows.length > 0) {
            console.log(`🏆 TOP 10 CLIENTES:`);
            customersResult.rows.forEach((customer, idx) => {
                const parts = customer.buyer_ref ? customer.buyer_ref.split('|') : ['Desconhecido'];
                const name = parts[0] || 'Desconhecido';
                const phone = parts[1] || '';
                console.log(`   #${idx + 1}: ${name} (${phone}) - ${customer.tickets} tickets - R$ ${parseFloat(customer.amount).toFixed(2)}`);
            });
            console.log('');
        }

        // Comparação com o total da rifa
        const totalDrawStats = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'PAID') as total_paid,
                SUM(amount) FILTER (WHERE status = 'PAID') as total_revenue
            FROM orders
            WHERE draw_id = $1
        `, [lastDraw.id]);

        const drawTotal = totalDrawStats.rows[0];
        const totalDrawRevenue = parseFloat(drawTotal.total_revenue || 0);
        const shareOfRevenue = totalDrawRevenue > 0 ? (revenue / totalDrawRevenue * 100) : 0;
        const shareOfTickets = parseInt(drawTotal.total_paid) > 0 ? (parseInt(stats.paid_tickets) / parseInt(drawTotal.total_paid) * 100) : 0;

        console.log(`📊 PARTICIPAÇÃO NA RIFA:`);
        console.log(`   Total da Rifa: ${drawTotal.total_paid} tickets - R$ ${totalDrawRevenue.toFixed(2)}`);
        console.log(`   Share do Afiliado: ${shareOfTickets.toFixed(1)}% dos tickets | ${shareOfRevenue.toFixed(1)}% da receita`);
        console.log('');

        console.log('✅ Análise concluída!\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

analyzeAffiliatePerformance();
