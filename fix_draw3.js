const { query } = require('./src/database/db');

async function fixDraw3() {
    try {
        console.log('Fixing Draw 3...');

        // Get draw details for prize calc
        const res = await query(`SELECT * FROM draws WHERE id = 3`);
        const draw = res.rows[0];

        if (!draw) {
            console.error('Draw 3 not found');
            process.exit(1);
        }

        const totalPrize = parseFloat(draw.prize_base) + parseFloat(draw.reserve_amount);
        const winnersCount = 2; // Paula and Leidivan
        const payoutEach = totalPrize / winnersCount;

        console.log(`Prize: ${totalPrize}, Winners: ${winnersCount}, Each: ${payoutEach}`);

        // Update
        await query(`
            UPDATE draws 
            SET drawn_number = 47,
                winners_count = $1,
                payout_each = $2
            WHERE id = 3
        `, [winnersCount, payoutEach]);

        console.log('✅ Draw 3 updated!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixDraw3();
