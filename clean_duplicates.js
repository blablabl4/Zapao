/**
 * Script to clean duplicate sub-affiliates by phone number
 * Keeps the first entry (earliest ID), removes duplicates
 */
require('dotenv').config();
const { Pool } = require('pg');

async function cleanDuplicates() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        console.log('🔍 Finding duplicate sub-affiliates by phone...\n');

        // Find phones with more than one entry
        const dupePhones = await pool.query(`
            SELECT sub_phone, COUNT(*) as cnt
            FROM sub_affiliates
            WHERE sub_phone IS NOT NULL AND sub_phone != ''
            GROUP BY sub_phone
            HAVING COUNT(*) > 1
        `);

        console.log(`Found ${dupePhones.rows.length} phones with duplicates:\n`);

        let totalDeleted = 0;

        for (const row of dupePhones.rows) {
            // Get all entries for this phone, ordered by ID (keep first)
            const entries = await pool.query(`
                SELECT id, sub_name, sub_code 
                FROM sub_affiliates 
                WHERE sub_phone = $1 
                ORDER BY id ASC
            `, [row.sub_phone]);

            console.log(`📱 Phone: ${row.sub_phone}`);
            console.log(`   ✅ Keeping: ${entries.rows[0].sub_name} (${entries.rows[0].sub_code})`);

            // Delete all except first
            const toDelete = entries.rows.slice(1);
            for (const dup of toDelete) {
                console.log(`   ❌ Deleting: ${dup.sub_name} (${dup.sub_code})`);
                await pool.query('DELETE FROM sub_affiliates WHERE id = $1', [dup.id]);
                totalDeleted++;
            }
            console.log('');
        }

        console.log(`\n✅ Cleanup complete! Deleted ${totalDeleted} duplicate entries.`);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

cleanDuplicates();
