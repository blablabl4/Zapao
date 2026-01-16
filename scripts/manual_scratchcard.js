const { query } = require('../src/database/db');
const crypto = require('crypto');

async function run() {
    try {
        const phone = '11983426767'; // User phone
        console.log(`Buscando usuário ${phone}...`);

        // 1. Get User
        const userRes = await query('SELECT * FROM customers WHERE phone = $1', [phone]);
        if (userRes.rowCount === 0) throw new Error('Usuario nao encontrado');
        const user = userRes.rows[0];
        console.log('Usuário:', user.name);

        // 2. Get Active Draw
        const drawRes = await query("SELECT * FROM draws WHERE status = 'ACTIVE' LIMIT 1");
        if (drawRes.rowCount === 0) throw new Error('Sorteio nao encontrado');
        const draw = drawRes.rows[0];
        console.log('Sorteio:', draw.id);

        // Find available number
        const soldRes = await query('SELECT number FROM orders WHERE draw_id = $1', [draw.id]);
        const soldNumbers = new Set(soldRes.rows.map(r => r.number));
        let number = 1;
        while (soldNumbers.has(number) && number <= 150) {
            number++;
        }
        if (number > 150) throw new Error('Todos os numeros vendidos!');
        console.log('Numero sorteado para teste:', number);

        // 3. Create ORDER directly
        const orderId = crypto.randomUUID();
        const amount = 50.00;

        await query(`
            INSERT INTO orders (order_id, number, amount, status, created_at, expires_at, buyer_ref, draw_id, customer_id)
            VALUES ($1, $2, $3, 'PAID', NOW(), NOW() + interval '1 hour', $4, $5, $6)
        `, [orderId, number, amount, `${user.name}|${user.phone}`, draw.id, user.id]);

        console.log(`Pedido ${orderId} criado (R$ 50.00)`);

        // Update Config to 1.00 for future
        await query("UPDATE scratch_config SET value = '1.00' WHERE key = 'min_order_value'");
        console.log('Config min_order_value atualizada para 1.00');

        // 4. Create 5 SCRATCHCARDS directly
        const cards = [];
        for (let i = 0; i < 5; i++) {
            const token = crypto.randomUUID();
            const isWinner = i === 0; // First one wins
            const prize = isWinner ? 10.00 : 0;

            // id is serial, do not insert
            await query(`
                INSERT INTO scratchcards (token, order_id, customer_id, draw_id, is_winner, prize_value, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW())
            `, [token, orderId, user.id, draw.id, isWinner, prize]);
            cards.push({ token, win: isWinner });
        }

        console.log('==========================================');
        console.log(`SUCESSO! 5 RASPADINHAS INSERIDAS!`);
        console.log('==========================================');
        process.exit(0);
    } catch (e) {
        console.error('ERRO:', e);
        process.exit(1);
    }
}

run();
