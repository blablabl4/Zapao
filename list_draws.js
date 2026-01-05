const { query } = require('./src/database/db');

async function listDraws() {
    try {
        const res = await query(`
            SELECT id, draw_name, status, created_at, drawn_number, winners_count 
            FROM draws 
            ORDER BY created_at DESC
        `);
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

listDraws();
