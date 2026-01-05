const { query } = require('./src/database/db');

async function listDraws() {
    try {
        const res = await query('SELECT * FROM draws ORDER BY id ASC');
        console.log(JSON.stringify(res.rows, null, 2));

        // Also check if ANY draw has drawn_number = 46
        const check46 = await query('SELECT * FROM draws WHERE drawn_number = 46');
        if (check46.rows.length > 0) {
            console.log('\n--- DRAWS WITH NUMBER 46 ---');
            console.log(JSON.stringify(check46.rows, null, 2));
        } else {
            console.log('\nNO DRAW has number 46 set as winner.');
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

listDraws();
