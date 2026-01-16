require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT sub_name, sub_phone, sub_code, parent_phone FROM sub_affiliates WHERE LOWER(sub_name) LIKE '%marcos%'")
    .then(r => {
        console.log('Resultados para Marcos:');
        r.rows.forEach(row => {
            console.log('Nome:', row.sub_name);
            console.log('Telefone:', row.sub_phone);
            console.log('Código:', row.sub_code);
            console.log('Padrinho:', row.parent_phone);
            console.log('---');
        });
        if (r.rows.length === 0) console.log('Nenhum resultado encontrado');
    })
    .finally(() => pool.end());
