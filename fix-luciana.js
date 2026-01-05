const { query } = require('./src/database/db');

(async () => {
    try {
        console.log('Updating Luciana address...');

        // Find Luciana's winning order in Rifa 3 (number 60)
        // We know from previous check it has no address info

        // Fetch current data first to keep phone/pix
        const res = await query(`
            SELECT order_id, buyer_ref 
            FROM orders 
            WHERE status = 'PAID' AND number = 60
            AND draw_id = (SELECT id FROM draws WHERE draw_name = 'Rifa 3')
        `);

        if (res.rows.length === 0) {
            console.log('Order not found!');
            process.exit(0);
        }

        const order = res.rows[0];
        const parts = order.buyer_ref.split('|');
        // parts: [name, phone, pix, bairro, city, cep]

        const name = parts[0];
        const phone = parts[1];
        const pix = parts[2] || '';

        // Set new address
        const bairro = 'Centro';
        const city = 'São Paulo';
        const cep = '01001000';

        const newRef = `${name}|${phone}|${pix}|${bairro}|${city}|${cep}`;

        await query('UPDATE orders SET buyer_ref = $1 WHERE order_id = $2', [newRef, order.order_id]);
        console.log('Updated order', order.id);
        console.log('Old:', order.buyer_ref);
        console.log('New:', newRef);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
