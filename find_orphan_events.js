const { query } = require('./src/database/db');

async function findOrphanEvents() {
    console.log('--- Finding Events from 30/12 Orphan Window (14:30-16:00 BRT) ---');
    try {
        // Query events from 30/12 between 17:30-19:00 UTC (which is 14:30-16:00 BRT if DB stores UTC)
        // Or try 14:30-16:00 directly if DB stores local time

        const sql = `
            SELECT id, type, name, phone, cpf, timestamp, campaign_id
            FROM az_events
            WHERE timestamp >= '2025-12-30 17:30:00' AND timestamp <= '2025-12-30 19:00:00'
            ORDER BY timestamp ASC
        `;

        const res = await query(sql);
        console.log(`Found ${res.rows.length} events in UTC window (17:30-19:00).`);

        if (res.rows.length > 0) {
            res.rows.forEach(r => {
                console.log(`[${r.id}] ${r.type} | ${r.name} | ${r.phone} | ${r.timestamp}`);
            });
        }

        // Also try local time range
        console.log('\n--- Trying Local Time (14:30-16:00) ---');
        const sql2 = `
            SELECT id, type, name, phone, cpf, timestamp, campaign_id
            FROM az_events
            WHERE timestamp >= '2025-12-30 14:30:00' AND timestamp <= '2025-12-30 16:00:00'
            ORDER BY timestamp ASC
        `;

        const res2 = await query(sql2);
        console.log(`Found ${res2.rows.length} events in local window.`);

        if (res2.rows.length > 0) {
            res2.rows.forEach(r => {
                console.log(`[${r.id}] ${r.type} | ${r.name} | ${r.phone} | ${r.timestamp}`);
            });
        }

        // Also check earliest event in table
        console.log('\n--- Earliest Events in Table ---');
        const earliest = await query("SELECT * FROM az_events ORDER BY timestamp ASC LIMIT 5");
        earliest.rows.forEach(r => {
            console.log(`[${r.id}] ${r.timestamp} | ${r.type} | ${r.name}`);
        });

    } catch (e) {
        console.error(e);
    }
}
findOrphanEvents();
