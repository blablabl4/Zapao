require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runDiagnosis() {
    const client = await pool.connect();
    try {
        console.log('--- DB DIAGNOSIS START ---');

        // 1. Basic Connectivity
        const start = Date.now();
        const res = await client.query('SELECT NOW()');
        console.log(`[PASS] Connection OK. Latency: ${Date.now() - start}ms`);

        // 2. Check Lock Contention
        console.log('\n--- CHECKING LOCKS ---');
        const locks = await client.query(`
            SELECT count(*) as lock_count 
            FROM pg_locks l
            JOIN pg_stat_activity a ON l.pid = a.pid
            WHERE a.application_name != 'pg_dump'
        `);
        console.log('Active Locks:', locks.rows[0].lock_count);

        // 3. Simulate Candidate Query (Hardcoded for typical scan)
        console.log('\n--- SIMULATING CANDIDATE QUERY ---');
        // Find an active campaign first
        const camps = await client.query('SELECT id FROM az_campaigns WHERE is_active = true LIMIT 1');
        if (camps.rows.length === 0) {
            console.log('[WARN] No active campaign found to test query.');
        } else {
            const cid = camps.rows[0].id;
            console.log('Testing Query for Campaign ID:', cid);
            const qStart = Date.now();
            const qRes = await client.query(`
                EXPLAIN ANALYZE
                SELECT t.number
                FROM az_tickets t
                JOIN az_campaigns cam ON t.campaign_id = cam.id
                LEFT JOIN az_claims c ON t.assigned_claim_id = c.id
                WHERE t.campaign_id = $1
                  AND t.number >= cam.start_number
                  AND t.number <= cam.end_number
                ORDER BY RANDOM()
                LIMIT 60
            `, [cid]);
            console.log(`[PASS] Query Time: ${Date.now() - qStart}ms`);
            console.log('Plan:', qRes.rows.map(r => r['QUERY PLAN']).join('\n').substring(0, 500) + '...');
        }

    } catch (e) {
        console.error('[FAIL] Diagnosis Failed:', e);
    } finally {
        client.release();
        await pool.end();
        console.log('--- DIAGNOSIS END ---');
    }
}

runDiagnosis();
