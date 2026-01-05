const { query, getClient } = require('./src/database/db');

async function setup() {
    console.log('--- Configurando Zapão da Sorte (Campanha 3) ---');

    // 1. Create Logs Table
    await query(`
        CREATE TABLE IF NOT EXISTS az_logs (
            id SERIAL PRIMARY KEY,
            level VARCHAR(20) NOT NULL DEFAULT 'INFO',
            event VARCHAR(50) NOT NULL,
            message TEXT,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);
    console.log('✅ Tabela az_logs verificada/criada.');

    // 2. Insert/Update Campaign
    // ID 3, Price 150 (R$ 1.50), Range 1-75
    // Status 'active'
    const campRes = await query(`
        INSERT INTO az_campaigns (id, name, start_number, end_number, price_cents, is_active, created_at)
        VALUES (3, 'Zapão da Sorte', 1, 75, 150, true, NOW())
        ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name,
            start_number = EXCLUDED.start_number,
            end_number = EXCLUDED.end_number,
            price_cents = EXCLUDED.price_cents,
            is_active = true;
    `);
    console.log('✅ Campanha 3 (Zapão) configurada.');

    // 3. Populate Tickets (1 to 75)
    // Clear existing tickets for this campaign to be safe (or upsert)
    // Using transaction for safety
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Delete old tickets for C3 to ensure clean slate (1-75 range might differ from previous)
        await client.query('DELETE FROM az_tickets WHERE campaign_id = 3 AND status = \'AVAILABLE\'');

        let inserted = 0;
        for (let i = 1; i <= 75; i++) {
            const res = await client.query(`
                INSERT INTO az_tickets (campaign_id, number, status, round_number)
                VALUES (3, $1, 'AVAILABLE', 1)
                ON CONFLICT (campaign_id, number, round_number) DO NOTHING
            `, [i]);
            inserted += res.rowCount;
        }

        await client.query('COMMIT');
        console.log(`✅ Tickets 01-75 gerados/verificados. Novos inseridos: ${inserted}`);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao gerar tickets:', e);
        process.exit(1);
    } finally {
        client.release();
    }
}

setup().then(() => {
    console.log('--- Setup Concluído ---');
    process.exit(0);
});
