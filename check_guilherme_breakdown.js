const { query } = require('./src/database/db');

async function checkGuilherme() {
    try {
        const PHONE = '11995622411';
        const RATE = 0.50;
        const MP_FEE_MULTIPLIER = 0.9901;

        console.log(`--- RELATÓRIO DETALHADO: GUILHERME MORAES (${PHONE}) ---`);
        console.log(`Taxa de Comissão: ${(RATE * 100)}% | Taxa MP desc: 0.99%`);

        const res = await query(`
            SELECT 
                d.draw_name,
                COUNT(*) as tickets_sold,
                COALESCE(SUM(o.amount), 0) as total_sales
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            WHERE o.referrer_id = $1 
            AND o.status = 'PAID'
            GROUP BY d.draw_name
            ORDER BY total_sales DESC
        `, [PHONE]);

        const rows = res.rows;
        let totalSales = 0;
        let totalCom = 0;

        const results = rows.map(r => {
            const sales = parseFloat(r.total_sales);
            const liquidSales = sales * MP_FEE_MULTIPLIER;
            const commission = liquidSales * RATE;

            totalSales += sales;
            totalCom += commission;

            return {
                Rifa: r.draw_name,
                Qtd: r.tickets_sold,
                VendasBrutas: `R$ ${sales.toFixed(2)}`,
                Comissao: `R$ ${commission.toFixed(2)}`
            };
        });

        console.table(results);
        console.log('------------------------------------------------');
        console.log(`TOTAL VENDAS:   R$ ${totalSales.toFixed(2)}`);
        console.log(`TOTAL COMISSÃO: R$ ${totalCom.toFixed(2)}`);
        console.log('------------------------------------------------');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkGuilherme();
