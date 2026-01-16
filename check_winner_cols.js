require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'winner_payments'")
    .then(r => {
        console.log('winner_payments columns:', r.rows.map(x => x.column_name).join(', '));
    })
    .catch(e => console.error(e))
    .finally(() => pool.end());
