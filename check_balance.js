require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAffiliateBalance() {
    try {
        const phone = '11951324444';
        const alreadyPaid = 0;

        console.log(`\n=== Saldo do Afiliado: ${phone} ===\n`);

        // 1. Check affiliates table
        const affRes = await pool.query("SELECT * FROM affiliates WHERE phone = $1", [phone]);
        if (affRes.rows.length > 0) {
            console.log('👤 Afiliado:', affRes.rows[0].name);
        }

        // 2. Get all orders with this referrer_id across ALL draws
        const ordersRes = await pool.query(`
            SELECT 
                o.draw_id,
                d.draw_name,
                COUNT(*) as ticket_count,
                SUM(o.amount) as total_revenue
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            WHERE o.referrer_id = $1 AND o.status = 'PAID'
            GROUP BY o.draw_id, d.draw_name
            ORDER BY o.draw_id DESC
        `, [phone]);

        let grandTotalRevenue = 0;
        let grandTotalTickets = 0;

        console.log('\n📊 Vendas por Rifa:\n');
        for (const row of ordersRes.rows) {
            const revenue = parseFloat(row.total_revenue);
            grandTotalRevenue += revenue;
            grandTotalTickets += parseInt(row.ticket_count);
            console.log(`  ${row.draw_name}: ${row.ticket_count} tickets = R$ ${revenue.toFixed(2)}`);
        }

        // 3. Calculate commission (50% for main affiliate, after 0.99% platform fee)
        const platformFee = 0.0099;
        const commissionRate = 0.50;
        const netRevenue = grandTotalRevenue * (1 - platformFee);
        const totalCommission = netRevenue * commissionRate;

        // 4. Also check for sub-affiliate commissions (25% of their subs' sales)
        const subsRes = await pool.query(`
            SELECT sub_code FROM sub_affiliates WHERE parent_phone = $1
        `, [phone]);

        let subCommission = 0;
        if (subsRes.rows.length > 0) {
            const subCodes = subsRes.rows.map(r => r.sub_code);
            const subSalesRes = await pool.query(`
                SELECT SUM(amount) as total FROM orders 
                WHERE referrer_id = ANY($1) AND status = 'PAID'
            `, [subCodes]);

            if (subSalesRes.rows[0].total) {
                const subRevenue = parseFloat(subSalesRes.rows[0].total);
                const subNetRevenue = subRevenue * (1 - platformFee);
                subCommission = subNetRevenue * 0.25; // Parent gets 25% of subs
                console.log(`\n  👥 Comissão de Sub-Afiliados: R$ ${subCommission.toFixed(2)}`);
            }
        }

        const grandTotalCommission = totalCommission + subCommission;
        const balance = grandTotalCommission - alreadyPaid;

        console.log('\n========================================');
        console.log(`📦 Total Tickets Vendidos: ${grandTotalTickets}`);
        console.log(`💰 Receita Total: R$ ${grandTotalRevenue.toFixed(2)}`);
        console.log(`📊 Comissão Total (50%): R$ ${totalCommission.toFixed(2)}`);
        if (subCommission > 0) {
            console.log(`👥 + Comissão Subs (25%): R$ ${subCommission.toFixed(2)}`);
        }
        console.log(`💵 TOTAL COMISSÕES: R$ ${grandTotalCommission.toFixed(2)}`);
        console.log(`✅ Já Pago: R$ ${alreadyPaid.toFixed(2)}`);
        console.log(`\n🎯 SALDO DISPONÍVEL: R$ ${balance.toFixed(2)}`);
        console.log('========================================\n');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

checkAffiliateBalance();
