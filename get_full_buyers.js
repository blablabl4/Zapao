const { query } = require('./src/database/db');
const fs = require('fs');

async function getFullBuyers() {
    try {
        const lastDraw = await query(`
            SELECT id, draw_name, total_numbers 
            FROM draws 
            WHERE status = 'CLOSED' 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        const draw = lastDraw.rows[0];

        const fullBuyers = await query(`
            SELECT 
                split_part(buyer_ref, '|', 1) as nome,
                split_part(buyer_ref, '|', 2) as telefone,
                COUNT(*) as total
            FROM orders 
            WHERE draw_id = $1 AND status = 'PAID'
            GROUP BY split_part(buyer_ref, '|', 1), split_part(buyer_ref, '|', 2)
            HAVING COUNT(*) >= $2
            ORDER BY split_part(buyer_ref, '|', 1)
        `, [draw.id, draw.total_numbers]);

        let output = `Ultima Rifa: ${draw.draw_name} (${draw.total_numbers} numeros)\n\n`;
        output += 'CLIENTES QUE COMPRARAM TODOS OS NUMEROS:\n\n';

        fullBuyers.rows.forEach((r, i) => {
            output += `${i + 1}. ${r.nome} | ${r.telefone}\n`;
        });

        output += `\nTotal: ${fullBuyers.rows.length} clientes`;

        fs.writeFileSync('clientes_todos_numeros.txt', output);
        console.log(output);
        process.exit(0);
    } catch (e) {
        console.error('Erro:', e);
        process.exit(1);
    }
}

getFullBuyers();
