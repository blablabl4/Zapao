const { query } = require('./src/database/db');

async function debugReferrerIds() {
    console.log('\n🔍 Debugging referrer_ids...\n');

    const result = await query(`
        SELECT DISTINCT referrer_id
        FROM orders
        WHERE draw_id = 23 AND status = 'PAID' AND referrer_id IS NOT NULL
        ORDER BY referrer_id
        LIMIT 5
    `);

    for (const row of result.rows) {
        const refId = row.referrer_id;
        console.log(`\nReferrer ID: ${refId}`);
        console.log(`Length: ${refId.length}`);

        try {
            const decoded = Buffer.from(refId, 'base64').toString('utf-8');
            console.log(`Decoded: ${decoded}`);

            if (decoded.includes('-')) {
                const phone = decoded.split('-')[0];
                console.log(`Phone: ${phone}`);
            }
        } catch (e) {
            console.log(`Decode error: ${e.message}`);
        }
    }
}

debugReferrerIds()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
