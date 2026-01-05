const { query } = require('../src/database/db');

async function listDraws() {
    try {
        const res = await query(`
            SELECT id, draw_name, status, created_at, closed_at 
            FROM draws 
            ORDER BY created_at DESC
        `);

        console.log(`\n=== LISTA DE SORTEIOS ===`);
        if (res.rows.length === 0) {
            console.log("Nenhum sorteio encontrado.");
        } else {
            res.rows.forEach(d => {
                const created = new Date(d.created_at).toLocaleString('pt-BR');
                const closed = d.closed_at ? new Date(d.closed_at).toLocaleString('pt-BR') : '---';
                console.log(`[${d.id}] ${d.draw_name} | Status: ${d.status} | Criado: ${created} | Fechado: ${closed}`);
            });
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

listDraws();
