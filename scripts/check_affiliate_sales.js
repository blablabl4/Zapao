const { query } = require('../src/database/db');

(async () => {
    try {
        console.log('=== RELATÓRIO DE VENDAS POR AFILIADO ===\n');

        // Query affiliate sales
        const res = await query(`
            SELECT 
                referrer_id, 
                COUNT(1) as tickets, 
                SUM(amount) as revenue 
            FROM orders 
            WHERE referrer_id IS NOT NULL 
              AND referrer_id != '' 
              AND status = 'PAID' 
            GROUP BY referrer_id 
            ORDER BY tickets DESC
        `);

        if (res.rows.length === 0) {
            console.log('❌ Nenhuma venda por afiliado encontrada.');
        } else {
            console.log(`✅ Total de afiliados com vendas: ${res.rows.length}\n`);

            let totalTickets = 0;
            let totalRevenue = 0;

            res.rows.forEach((r, i) => {
                const tickets = parseInt(r.tickets);
                const revenue = parseFloat(r.revenue);
                totalTickets += tickets;
                totalRevenue += revenue;

                // Try to decode referrer_id
                let phone = r.referrer_id;
                try {
                    const decoded = Buffer.from(r.referrer_id, 'base64').toString('utf-8');
                    if (decoded.includes('-')) {
                        phone = decoded.split('-')[0];
                    }
                } catch (e) { }

                console.log(`${i + 1}. Tel: ${phone} | Tickets: ${tickets} | R$ ${revenue.toFixed(2)}`);
            });

            console.log(`\n--- TOTAL ---`);
            console.log(`Tickets: ${totalTickets}`);
            console.log(`Revenue: R$ ${totalRevenue.toFixed(2)}`);
        }

        process.exit(0);
    } catch (e) {
        console.error('Erro:', e.message);
        process.exit(1);
    }
})();
