const { query } = require('./src/database/db');
const fs = require('fs');

async function getInactiveCustomers() {
    try {
        const activeDraw = await query(`
            SELECT id, draw_name FROM draws WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1
        `);

        const currentDrawId = activeDraw.rows[0].id;

        // Get unique customers by phone (normalized) who bought before but NOT in current draw
        const result = await query(`
            WITH previous_buyers AS (
                SELECT 
                    split_part(buyer_ref, '|', 1) as nome,
                    REGEXP_REPLACE(split_part(buyer_ref, '|', 2), '[^0-9]', '', 'g') as telefone_limpo,
                    split_part(buyer_ref, '|', 2) as telefone_original,
                    created_at
                FROM orders
                WHERE status = 'PAID' AND draw_id < $1
            ),
            unique_buyers AS (
                SELECT DISTINCT ON (telefone_limpo)
                    nome,
                    telefone_limpo,
                    telefone_original
                FROM previous_buyers
                WHERE LENGTH(telefone_limpo) >= 10
                ORDER BY telefone_limpo, created_at DESC
            )
            SELECT nome, telefone_original as telefone FROM unique_buyers
            WHERE telefone_limpo NOT IN (
                SELECT DISTINCT REGEXP_REPLACE(split_part(buyer_ref, '|', 2), '[^0-9]', '', 'g')
                FROM orders
                WHERE draw_id = $1 AND status = 'PAID'
            )
            ORDER BY nome
        `, [currentDrawId]);

        let output = `CLIENTES INATIVOS (VALIDADO POR TELEFONE - SEM DUPLICADOS)\n`;
        output += `Rifa atual: ${activeDraw.rows[0].draw_name}\n\n`;

        result.rows.forEach((r, i) => {
            output += `${i + 1}. ${r.nome} | ${r.telefone}\n`;
        });

        output += `\nTotal: ${result.rows.length} clientes unicos`;

        fs.writeFileSync('clientes_inativos.txt', output);
        console.log(output);
        process.exit(0);
    } catch (e) {
        console.error('Erro:', e);
        process.exit(1);
    }
}

getInactiveCustomers();
