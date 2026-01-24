const { query } = require('./src/database/db');

async function checkRobertinha() {
    try {
        const PARENT = '11947781150';
        console.log(`Searching for Robertinha (Sub of ${PARENT})...`);

        // 1. Find Sub Record
        const subRes = await query(`
            SELECT * FROM sub_affiliates 
            WHERE parent_phone = $1 
            AND sub_name ILIKE '%Robertinha%'
        `, [PARENT]);

        if (subRes.rows.length === 0) {
            console.log('No sub-affiliate found with name like "Robertinha" for this parent.');
            // Try searching just by name globally in case parent mapping is different
            const globalRes = await query(`SELECT * FROM sub_affiliates WHERE sub_name ILIKE '%Robertinha%'`);
            if (globalRes.rows.length > 0) {
                console.log('Found "Robertinha" under different parents:', globalRes.rows);
            }
            process.exit(0);
        }

        const robertinha = subRes.rows[0];
        console.log('Found:', robertinha);

        // 2. Breakdown Sales
        const salesRes = await query(`
            SELECT 
                d.draw_name,
                COUNT(*) as qtd,
                COALESCE(SUM(o.amount), 0) as total
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            WHERE o.referrer_id = $1
            AND o.status = 'PAID'
            GROUP BY d.draw_name
        `, [robertinha.sub_code]);

        const rows = salesRes.rows;
        let totalSales = 0;

        console.table(rows.map(r => {
            totalSales += parseFloat(r.total);
            return {
                Rifa: r.draw_name,
                Qtd: r.qtd,
                Vendas: `R$ ${parseFloat(r.total).toFixed(2)}`
            };
        }));

        console.log('-----------------------------------');
        console.log(`TOTAL VENDIDO: R$ ${totalSales.toFixed(2)}`);

        // Calculate Commissions
        const NET_SALES = totalSales * 0.9901;
        const HER_COM = NET_SALES * 0.25; // 25%
        const PARENT_BONUS = NET_SALES * 0.05; // 5%

        console.log(`Comissão dela (25% Liq): R$ ${HER_COM.toFixed(2)}`);
        console.log(`Bônus do Marcos (5% Liq): R$ ${PARENT_BONUS.toFixed(2)}`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkRobertinha();
