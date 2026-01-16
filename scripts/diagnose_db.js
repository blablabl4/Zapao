const { query } = require('../src/database/db');

async function checkDraws() {
    try {
        console.log('--- Checking Recent Draws ---');
        const res = await query('SELECT id, draw_name, status, winners_count, closed_at FROM draws ORDER BY id DESC LIMIT 5');
        console.table(res.rows);

        console.log('--- Checking Scratchcards Table Existence ---');
        try {
            await query('SELECT count(*) FROM scratchcards');
            console.log('Scratchcards table EXISTS');
        } catch (e) {
            console.log('Scratchcards table DOES NOT EXIST');
        }
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}

checkDraws();
