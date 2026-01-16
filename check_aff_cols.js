require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sub_affiliates'")
    .then(r => {
        console.log('affiliates columns:', r.rows.map(x => x.column_name).join(', '));
    })
    .catch(e => console.error(e))
    .finally(() => pool.end());
