const { getPool } = require('../src/database/db');

async function listGroups() {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM whatsapp_groups ORDER BY id ASC');
    console.table(res.rows);
    process.exit();
}

listGroups();
