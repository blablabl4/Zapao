const { query } = require('./src/database/db');

async function check() {
    try {
        console.log('--- CHECKING ACTIVE DRAWS ---');
        const res = await query("SELECT id, status, draw_name FROM draws WHERE status = 'active' OR status = 'open' ORDER BY id DESC");
        console.log('Active/Open Draws found:', res.rows.length);
        console.table(res.rows);

        console.log('\n--- CHECKING ALL DRAWS ---');
        const allRes = await query("SELECT id, status, draw_name FROM draws ORDER BY id DESC LIMIT 5");
        console.table(allRes.rows);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
