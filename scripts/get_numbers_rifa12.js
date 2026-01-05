const { query } = require('../src/database/db');

async function getNumbers() {
    try {
        const phone = '11979740034';
        const searchDraw = '12'; // Looking for "Rifa 12" or similar

        console.log(`🔎 Buscando números para ${phone} na Rifa contendo "${searchDraw}"...`);

        const res = await query(`
            SELECT o.number, o.status, d.draw_name
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            WHERE o.buyer_ref LIKE $1
            AND d.draw_name LIKE $2
            AND o.status = 'PAID'
            ORDER BY o.number ASC
        `, [`%${phone}%`, `%${searchDraw}%`]);

        if (res.rows.length === 0) {
            console.log("❌ Nenhum número PAGO encontrado para essa combinação.");
        } else {
            console.log(`\n✅ Encontrados ${res.rows.length} números PAGOS na ${res.rows[0].draw_name}:`);
            const numbers = res.rows.map(r => r.number).join(', ');
            console.log(`🔢 Números: ${numbers}`);
        }

    } catch (e) {
        console.error("Erro:", e);
    } finally {
        process.exit();
    }
}

getNumbers();
