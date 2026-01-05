const { query } = require('./src/database/db');

(async () => {
    try {
        // Delete Rodada Inicial
        await query("DELETE FROM draws WHERE draw_name = 'Rodada Inicial' AND status = 'SCHEDULED'");
        console.log('Deleted Rodada Inicial');

        // Fix name to Rifa 4
        await query("UPDATE draws SET draw_name = 'Rifa 4' WHERE id = 9");
        console.log('Updated to Rifa 4');

        // Verify
        const draws = await query("SELECT id, draw_name, status FROM draws ORDER BY id DESC LIMIT 5");
        console.log('Current draws:');
        draws.rows.forEach(d => console.log(d.id, d.draw_name, d.status));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
