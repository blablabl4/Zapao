const { query } = require('./src/database/db');

async function checkMarcosSubs() {
    try {
        const PARENT = '11947781150';
        const MP_FEE_MULTIPLIER = 0.9901;

        console.log(`--- SUB-AFILIADOS DE MARCOS LUIZ (${PARENT}) ---`);

        // 1. Get all subs
        const subsRes = await query(`
            SELECT * FROM sub_affiliates 
            WHERE parent_phone = $1
        `, [PARENT]);

        const subs = subsRes.rows;
        if (subs.length === 0) {
            console.log('Nenhum sub-afiliado encontrado.');
            process.exit(0);
        }

        console.log(`Encontrados ${subs.length} sub-afiliados.`);
        console.log('-------------------------------------------');

        let grandTotalSales = 0;

        for (const sub of subs) {
            // 2. Get Sales Breakdown
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
                ORDER BY total DESC
            `, [sub.sub_code]);

            const rows = salesRes.rows;
            if (rows.length === 0) continue; // Skip if no sales

            let totalSubSales = 0;
            const details = rows.map(r => {
                const amount = parseFloat(r.total);
                totalSubSales += amount;
                return `${r.draw_name}: R$ ${amount.toFixed(2)} (${r.qtd})`;
            }).join(', ');

            grandTotalSales += totalSubSales;

            const netSales = totalSubSales * MP_FEE_MULTIPLIER;
            const subCom = netSales * 0.25;
            const parentBonus = netSales * 0.05;

            console.log(`[SUB] ${sub.sub_name} (Code: ${sub.sub_code})`);
            console.log(`   Vendas: R$ ${totalSubSales.toFixed(2)}`);
            console.log(`   Detalhes: ${details}`);
            console.log(`   Comissão do Sub (25% Liq): R$ ${subCom.toFixed(2)}`);
            console.log(`   Bônus do Marcos (5% Liq):  R$ ${parentBonus.toFixed(2)}`);
            console.log('-------------------------------------------');
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkMarcosSubs();
