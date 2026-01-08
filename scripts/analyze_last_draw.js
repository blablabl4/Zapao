const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function analyze() {
    try {
        // 1. Get Last Draw
        const drawRes = await pool.query(`
            SELECT * FROM draws 
            ORDER BY id DESC 
            LIMIT 1
        `);

        if (drawRes.rows.length === 0) {
            console.log("No draws found.");
            return;
        }

        const draw = drawRes.rows[0];
        console.log(`\n=== LAST RAFFLE INFO ===`);
        console.log(`ID: ${draw.id}`);
        console.log(`Name: ${draw.name || draw.draw_name}`);
        console.log(`Status: ${draw.status}`);
        console.log(`Prize: ${draw.prize_description || draw.prize_text}`);

        // 2. Check Number Frequency (most bettors per number)
        const numRes = await pool.query(`
            SELECT number, count(*) as count 
            FROM orders 
            WHERE draw_id = $1 AND status = 'PAID'
            GROUP BY number 
            ORDER BY count DESC 
            LIMIT 5
        `, [draw.id]);

        console.log(`\n=== NUMBERS WITH MOST BETTORS (Top 5) ===`);
        if (numRes.rows.length > 0) {
            numRes.rows.forEach(r => {
                console.log(`Number ${r.number}: ${r.count} bettor(s)`);
            });
        } else {
            console.log("No paid bets found.");
        }

        // 3. Top Bettors (Users with most numbers) - Just in case user meant this
        const userRes = await pool.query(`
            SELECT buyer_ref, count(*) as count 
            FROM orders 
            WHERE draw_id = $1 AND status = 'PAID'
            GROUP BY buyer_ref 
            ORDER BY count DESC 
            LIMIT 5
        `, [draw.id]);

        console.log(`\n=== TOP BETTORS (Most Numbers Bought) ===`);
        userRes.rows.forEach(r => {
            const name = r.buyer_ref ? r.buyer_ref.split('|')[0] : 'Unknown';
            console.log(`${name}: ${r.count} numbers`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

analyze();
