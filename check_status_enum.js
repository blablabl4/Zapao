const { query } = require('./src/database/db');

async function checkConstraint() {
    try {
        console.log('Testing EXPIRED status...');
        // Try to update a non-existent ID just to check if the value is allowed by enum
        // (Postgres checks enum validity even if 0 rows updated)
        // Actually, if it's a check constraint, it might not fail until row exists.
        // Let's inspect CHECK constraints.

        const constraints = await query(`
            SELECT pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE conrelid = 'az_claims'::regclass
            AND contype = 'c';
        `);

        console.log('Constraints on az_claims:');
        constraints.rows.forEach(r => console.log(r.definition));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkConstraint();
