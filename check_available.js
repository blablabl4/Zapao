const { query } = require('./src/database/db');

async function checkAvailableNumbers() {
    console.log(`\n🔍 Verificando números DISPONÍVEIS na rifa ATIVA...\n`);

    // Get current active draw
    const activeDraw = await query(`
        SELECT id, draw_name, total_numbers
        FROM draws
        WHERE status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 1
    `);

    if (activeDraw.rows.length === 0) {
        console.log('❌ Nenhuma rifa ATIVA no momento.');
        return;
    }

    const draw = activeDraw.rows[0];
    const totalNumbers = draw.total_numbers || 150; // Default to 150 if null

    console.log(`📌 Rifa Atual: ${draw.draw_name} (ID: ${draw.id})`);
    console.log(`   Range: 1 a ${totalNumbers}\n`);

    // Get sold numbers (PAID status only)
    const soldResult = await query(`
        SELECT DISTINCT number
        FROM orders
        WHERE draw_id = $1
        AND status = 'PAID'
        ORDER BY number ASC
    `, [draw.id]);

    const soldNumbers = soldResult.rows.map(row => row.number);
    const soldCount = soldNumbers.length;

    // Calculate available numbers
    const allNumbers = Array.from({ length: totalNumbers }, (_, i) => i + 1);
    const availableNumbers = allNumbers.filter(n => !soldNumbers.includes(n));

    console.log(`📊 ESTATÍSTICAS:`);
    console.log(`   Total de números: ${totalNumbers}`);
    console.log(`   Vendidos: ${soldCount} (${((soldCount / totalNumbers) * 100).toFixed(1)}%)`);
    console.log(`   Disponíveis: ${availableNumbers.length} (${((availableNumbers.length / totalNumbers) * 100).toFixed(1)}%)\n`);

    console.log(`✅ NÚMEROS DISPONÍVEIS (${availableNumbers.length}):`);
    console.log('='.repeat(60));

    // Format output in lines of 15 numbers
    const chunkSize = 15;
    for (let i = 0; i < availableNumbers.length; i += chunkSize) {
        const chunk = availableNumbers.slice(i, i + chunkSize);
        console.log(chunk.map(n => String(n).padStart(3, '0')).join(', '));
    }
    console.log('='.repeat(60));
    console.log('');
}

checkAvailableNumbers()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Erro:', err);
        process.exit(1);
    });
