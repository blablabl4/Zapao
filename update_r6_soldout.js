const { query } = require('./src/database/db');

async function setSoldOut() {
    console.log('--- Setting Jogo 6 as SOLD OUT (Advancing to Round 7) ---');
    try {
        // Update campaign 21 to round 7
        // Since there is no configuration for round 7, the system typically shows "Aguarde próxima rodada" or "Esgotado"
        const res = await query(`
            UPDATE az_campaigns 
            SET current_round = 7
            WHERE id = 21
            RETURNING id, name, current_round
        `);

        console.log('✅ Campaign updated:', res.rows[0]);

    } catch (e) {
        console.error(e);
    }
}

setSoldOut();
