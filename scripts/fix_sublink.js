const { query } = require('../src/database/db');

async function fixSubLink() {
    try {
        const subCode = 'rei-dos-brinquedos-olck';
        const targetPhone = '11991025621';

        console.log(`Checking for sub_code: ${subCode}`);
        const res = await query('SELECT * FROM sub_affiliates WHERE sub_code = $1', [subCode]);

        if (res.rows.length > 0) {
            console.log('Found record:', res.rows[0]);

            // Update
            console.log('Updating phone number...');
            await query('UPDATE sub_affiliates SET sub_phone = $1 WHERE sub_code = $2', [targetPhone, subCode]);
            console.log('Update successful.');

            // Verify
            const verify = await query('SELECT * FROM sub_affiliates WHERE sub_code = $1', [subCode]);
            console.log('Verified record:', verify.rows[0]);
        } else {
            console.log('Record NOT found.');
            // If not found, we can't easily insert without parent_phone. 
            // Checking if phone exists as parent?
            const parentCheck = await query('SELECT * FROM affiliates WHERE phone = $1', [targetPhone]);
            if (parentCheck.rows.length > 0) {
                console.log('Phone exists as Affiliate:', parentCheck.rows[0]);
            } else {
                console.log('Phone does not exist as main Affiliate either.');
            }
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

fixSubLink();
