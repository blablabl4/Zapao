const { query } = require('./src/database/db');

async function getKeys() {
    try {
        const res = await query(`
            SELECT buyer_ref
            FROM orders 
            WHERE number = 47 
              AND status = 'PAID'
            ORDER BY created_at DESC
        `);

        console.log('--- PIX KEYS ---');
        res.rows.forEach(r => {
            const parts = r.buyer_ref.split('|');
            const name = parts[0];
            const pix = parts[2] || 'Sem Pix';
            console.log(`Nome: ${name}`);
            console.log(`Pix:  ${pix}`);
            console.log('----------------');
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

getKeys();
