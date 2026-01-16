require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'push_subscriptions'")
    .then(r => {
        console.log('push_subscriptions columns:', r.rows.map(x => x.column_name).join(', '));
    })
    .finally(() => pool.end());
