const { query, pool } = require('../src/database/db');
require('dotenv').config();

async function debugBoundaries() {
    try {
        console.log('🔍 Checking Payment Boundaries for Jan 2nd...');

        console.log('--- NEXT PAYMENTS AFTER ID #108 (Last known Jan 2nd) ---');
        const sqlNext = `
            SELECT 
                p.id,
                p.amount_paid,
                p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as paid_local
            FROM payments p
            WHERE p.id > 108
            ORDER BY p.id ASC
            LIMIT 5
        `;
        const resNext = await query(sqlNext);
        console.table(resNext.rows);

        console.log('--- PREVIOUS PAYMENTS BEFORE ID #5 (First known Jan 2nd) ---');
        const sqlPrev = `
            SELECT 
                p.id,
                p.amount_paid,
                p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as paid_local
            FROM payments p
            WHERE p.id < 5
            ORDER BY p.id DESC
            LIMIT 5
        `;
        const resPrev = await query(sqlPrev);
        console.table(resPrev.rows);

        console.log('--- CHECKING JAN 3RD START ---');
        const sqlJan3 = `
             SELECT 
                p.id,
                p.amount_paid,
                p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as paid_local
            FROM payments p
            WHERE date(p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = '2026-01-03'
            ORDER BY p.paid_at ASC
            LIMIT 5
        `;
        const resJan3 = await query(sqlJan3);
        console.table(resJan3.rows);

        setTimeout(() => process.exit(0), 1000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugBoundaries();
