const { query } = require('./src/database/db');
query(`SELECT column_name FROM information_schema.columns WHERE table_name='az_claims'`)
    .then(r => {
        console.log('Columns:', r.rows.map(x => x.column_name).join(', '));
        process.exit();
    });
