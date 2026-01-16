require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function update() {
    const result = await pool.query(
        'UPDATE sub_affiliates SET sub_phone = $1 WHERE sub_code = $2 RETURNING *',
        ['11951965442', 'marcos-penha-w62z']
    );

    if (result.rows.length > 0) {
        console.log('✅ Atualizado com sucesso!');
        console.log('Nome:', result.rows[0].sub_name);
        console.log('Telefone:', result.rows[0].sub_phone);
        console.log('Código:', result.rows[0].sub_code);
    } else {
        console.log('❌ Não encontrado');
    }

    await pool.end();
}

update();
