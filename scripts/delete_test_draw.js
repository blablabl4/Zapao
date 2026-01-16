const { query } = require('../src/database/db');

async function deleteTestDraw() {
    try {
        console.log('🗑️  Iniciando deleção do draw de teste (ID 29)...\n');

        await query('BEGIN');

        // 1. Delete affiliate_clicks (FK de draw)
        const clicksResult = await query('DELETE FROM affiliate_clicks WHERE draw_id = 29 RETURNING id');
        console.log(`   ✅ ${clicksResult.rowCount} affiliate_clicks deletados`);

        // 2. Delete payments (FK de orders)
        const paymentsResult = await query(`
            DELETE FROM payments 
            WHERE order_id IN (SELECT order_id FROM orders WHERE draw_id = 29)
            RETURNING id
        `);
        console.log(`   ✅ ${paymentsResult.rowCount} payments deletados`);

        // 3. Delete scratchcards (FK de draw)
        const scratchResult = await query('DELETE FROM scratchcards WHERE draw_id = 29 RETURNING id');
        console.log(`   ✅ ${scratchResult.rowCount} scratchcards deletadas`);

        // 4. Delete orders
        const ordersResult = await query('DELETE FROM orders WHERE draw_id = 29 RETURNING order_id');
        console.log(`   ✅ ${ordersResult.rowCount} orders deletadas`);

        // 5. Delete draw
        const drawResult = await query('DELETE FROM draws WHERE id = 29 RETURNING draw_name');
        console.log(`   ✅ Draw "${drawResult.rows[0]?.draw_name || 'teste'}" deletado\n`);

        await query('COMMIT');
        console.log('✅ Transação completada com sucesso!');
        process.exit(0);
    } catch (e) {
        await query('ROLLBACK');
        console.error('❌ Erro ao deletar:', e.message);
        process.exit(1);
    }
}

deleteTestDraw();
