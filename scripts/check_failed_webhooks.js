const { query } = require('../src/database/db');

async function checkFailed() {
    try {
        const r = await query("SELECT COUNT(*) as count FROM webhook_events WHERE status = 'FAILED'");
        console.log('Webhooks Falhos:', r.rows[0].count);

        if (r.rows[0].count > 0) {
            const details = await query("SELECT id, created_at, status FROM webhook_events WHERE status = 'FAILED' ORDER BY created_at DESC LIMIT 5");
            console.table(details.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkFailed();
