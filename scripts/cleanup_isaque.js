const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getClient, closeDatabase } = require('../src/database/db');

async function runCleanup() {
    console.log('[Cleanup] Starting cleanup for "Isaque"...');
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // 1. Find Claims
        const findRes = await client.query(`
            SELECT id, name, phone FROM az_claims 
            WHERE name ILIKE '%isaque%'
        `);

        if (findRes.rows.length === 0) {
            console.log('[Cleanup] No users found with name "Isaque".');
            await client.query('ROLLBACK');
            return;
        }

        console.log(`[Cleanup] Found ${findRes.rows.length} users to remove:`);
        findRes.rows.forEach(u => console.log(` - ${u.name} (${u.phone})`));

        const claimIds = findRes.rows.map(u => u.id);

        // 2. Release Tickets (Set to AVAILABLE)
        const updateRes = await client.query(`
            UPDATE az_tickets 
            SET status = 'AVAILABLE', assigned_claim_id = NULL, updated_at = NOW()
            WHERE assigned_claim_id = ANY($1::int[])
        `, [claimIds]);

        console.log(`[Cleanup] Released ${updateRes.rowCount} tickets.`);

        // 3. Delete Claims
        const deleteRes = await client.query(`
            DELETE FROM az_claims 
            WHERE id = ANY($1::int[])
        `, [claimIds]);

        console.log(`[Cleanup] Deleted ${deleteRes.rowCount} claims.`);

        await client.query('COMMIT');
        console.log('[Cleanup] DONE! Success.');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[Cleanup] ERROR:', e);
    } finally {
        client.release();
        await closeDatabase();
    }
}

runCleanup();
