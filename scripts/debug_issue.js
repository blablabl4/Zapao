const { query, getClient } = require('../src/database/db');

async function debugUser() {
    try {
        const phone = '11981771974';
        console.log(`Searching for phone: ${phone}`);

        // 1. Get Customer
        const userRes = await query("SELECT * FROM customers WHERE phone LIKE $1", [`%${phone.slice(-8)}%`]);
        if (userRes.rows.length === 0) {
            console.log('User not found!');
            return;
        }
        const user = userRes.rows[0];
        console.log('Customer:', { id: user.id, phone: user.phone, name: user.name });

        // 2. Get Config
        const configRes = await query("SELECT * FROM scratch_config");
        console.log('Config:', configRes.rows.map(r => `${r.key}=${r.value}`));

        // 3. Get Recent Orders
        const ordersRes = await query(`
            SELECT order_id, status, amount, created_at, draw_id 
            FROM orders 
            WHERE customer_id = $1 
            ORDER BY created_at DESC 
            LIMIT 50
        `, [user.id]);

        console.log(`Found ${ordersRes.rows.length} recent orders.`);
        const paidOrders = ordersRes.rows.filter(o => o.status === 'PAID');
        console.log(`PAID orders count: ${paidOrders.length}`);

        if (ordersRes.rows.length > 0) {
            console.log('Most recent order:', ordersRes.rows[0]);
        }

        // 4. Check Scratchcards
        const cardsRes = await query(`
            SELECT * FROM scratchcards 
            WHERE customer_id = $1 
            ORDER BY created_at DESC
        `, [user.id]);

        console.log(`Scratchcards found: ${cardsRes.rows.length}`);
        cardsRes.rows.forEach(c => {
            console.log(`- Card ${c.id}: Status=${c.status}, Winner=${c.is_winner}, Token=${c.token}`);
        });

        // 5. Total Numbers Calculation
        // Assuming current draw is the one from the most recent order
        if (ordersRes.rows.length > 0) {
            // Get Draw ID from recent order
            // We need to query orders again or include draw_id
            const ordersFullRes = await query(`
                SELECT draw_id, status FROM orders WHERE customer_id = $1
            `, [user.id]);

            const statsByDraw = {};
            ordersFullRes.rows.forEach(o => {
                if (!statsByDraw[o.draw_id]) statsByDraw[o.draw_id] = { total: 0, paid: 0 };
                statsByDraw[o.draw_id].total++;
                if (o.status === 'PAID') statsByDraw[o.draw_id].paid++;
            });

            console.log('Stats by Draw:', statsByDraw);
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

debugUser();
