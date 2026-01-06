const { query } = require('../src/database/db');

async function findOtherIssues() {
    try {
        console.log(`\n========================================`);
        console.log(`BUSCANDO OUTROS CASOS PROBLEMÁTICOS`);
        console.log(`========================================\n`);

        // 1. Check for buyers with many EXPIRED but few/no PAID (potential payment issues)
        console.log(`=== BUYERS COM MUITOS EXPIRED E POUCOS/NENHUM PAID (últimos 7 dias) ===\n`);

        const potentialIssues = await query(`
            WITH buyer_stats AS (
                SELECT 
                    SPLIT_PART(buyer_ref, '|', 1) as name,
                    SPLIT_PART(buyer_ref, '|', 2) as phone,
                    draw_id,
                    SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired_count,
                    SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_count
                FROM orders
                WHERE created_at >= NOW() - INTERVAL '7 days'
                AND buyer_ref IS NOT NULL
                GROUP BY SPLIT_PART(buyer_ref, '|', 1), SPLIT_PART(buyer_ref, '|', 2), draw_id
            )
            SELECT name, phone, draw_id, expired_count, paid_count
            FROM buyer_stats
            WHERE expired_count >= 50 AND paid_count = 0
            ORDER BY expired_count DESC
            LIMIT 20
        `);

        if (potentialIssues.rows.length === 0) {
            console.log('✅ Nenhum caso suspeito encontrado (50+ EXPIRED sem PAID)');
        } else {
            console.log(`⚠️ ${potentialIssues.rows.length} casos suspeitos:`);
            potentialIssues.rows.forEach(r => {
                console.log(`  - ${r.name} (${r.phone}): ${r.expired_count} EXPIRED, ${r.paid_count} PAID (Draw ${r.draw_id})`);
            });
        }

        // 2. Check for duplicate PAID orders (same number in same draw)
        console.log(`\n=== NÚMEROS DUPLICADOS COM STATUS PAID (mesmo número, mesma rifa) ===\n`);

        const duplicatePaid = await query(`
            SELECT draw_id, number, COUNT(*) as count
            FROM orders
            WHERE status = 'PAID'
            GROUP BY draw_id, number
            HAVING COUNT(*) > 1
            ORDER BY count DESC
            LIMIT 20
        `);

        if (duplicatePaid.rows.length === 0) {
            console.log('✅ Nenhum número duplicado encontrado');
        } else {
            console.log(`⚠️ ${duplicatePaid.rows.length} números duplicados:`);
            duplicatePaid.rows.forEach(r => {
                console.log(`  - Número ${r.number} na Rifa ${r.draw_id}: ${r.count} vezes`);
            });
        }

        // 3. Summary of current draw
        console.log(`\n=== STATUS DA RIFA ATIVA ===\n`);

        const drawStats = await query(`
            SELECT 
                d.id, d.draw_name,
                COUNT(o.order_id) FILTER (WHERE o.status = 'PAID') as paid_count,
                COUNT(o.order_id) FILTER (WHERE o.status = 'PENDING') as pending_count,
                COUNT(o.order_id) FILTER (WHERE o.status = 'EXPIRED') as expired_count,
                SUM(o.amount) FILTER (WHERE o.status = 'PAID') as total_revenue
            FROM draws d
            LEFT JOIN orders o ON d.id = o.draw_id
            WHERE d.status = 'ACTIVE'
            GROUP BY d.id, d.draw_name
        `);

        if (drawStats.rows.length > 0) {
            const d = drawStats.rows[0];
            console.log(`Rifa: ${d.draw_name} (ID: ${d.id})`);
            console.log(`  PAID: ${d.paid_count}`);
            console.log(`  PENDING: ${d.pending_count}`);
            console.log(`  EXPIRED: ${d.expired_count}`);
            console.log(`  Receita: R$ ${parseFloat(d.total_revenue || 0).toFixed(2)}`);
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

findOtherIssues();
