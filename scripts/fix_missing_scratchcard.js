const { query } = require('../src/database/db');
const ScratchCardService = require('../src/services/ScratchCardService');
const OrderService = require('../src/services/OrderService');

async function fixMissingCard() {
    try {
        const phone = '11981771974';
        console.log(`Fixing missing card for phone: ${phone}`);

        // 1. Get Customer
        const userRes = await query("SELECT * FROM customers WHERE phone LIKE $1", [`%${phone.slice(-8)}%`]);
        const user = userRes.rows[0];
        console.log('Customer:', { id: user.id });

        // 2. Get one paid order to use as context
        const orderRes = await OrderService.getOrder('a7e87165-0df2-4d0f-bba8-6a11e1205d74'); // Order ID from debug output

        if (!orderRes) {
            console.error('Order not found!');
            return;
        }

        console.log('Using order context:', orderRes.order_id);

        // 3. Generate
        const tokens = await ScratchCardService.generateForOrder(orderRes);
        console.log('Result tokens:', tokens);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

fixMissingCard();
