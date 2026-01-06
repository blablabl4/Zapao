const { query } = require('../src/database/db');

async function debug() {
    try {
        console.log('Searching for 11983426767...');
        const res = await query("SELECT id, name, phone, length(phone) as len, is_active FROM admin_users WHERE phone = '11983426767'");
        console.table(res.rows);

        console.log('Searching for ANY similar number...');
        const res2 = await query("SELECT id, name, phone, length(phone) as len FROM admin_users WHERE phone LIKE '%983426767%'");
        console.table(res2.rows);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

debug();
