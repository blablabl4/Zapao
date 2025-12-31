const { MercadoPagoConfig, Payment } = require('mercadopago');
const { query } = require('./src/database/db');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

// Window: Today 00:00 -> First R2 Sale (23:04 Z)
// Adjusted End Time to be safe, using the one found: 2025-12-30T23:04:53.350Z
const START_TIME = '2025-12-30T00:00:00Z';
const END_TIME = '2025-12-30T23:04:53.350Z';

async function redistribute() {
    console.log(`--- Redistributing Early Payments (${START_TIME} -> ${END_TIME}) ---`);
    console.log('Target: Round 5');

    try {
        const history = await payment.search({
            options: {
                sort: 'date_created',
                criteria: 'asc',
                range: 'date_created',
                begin_date: START_TIME,
                end_date: END_TIME,
                status: 'approved',
                limit: 200 // Increase limit to catch all
            }
        });

        const results = history.results || [];
        console.log(`\nFound ${results.length} payments in time range.`);

        let fixedCount = 0;

        for (const p of results) {
            if (p.transaction_amount < 20) continue;

            // Check if already in DB
            const pid = p.id.toString();
            const check = await query("SELECT id FROM az_claims WHERE payment_id = $1", [pid]);

            if (check.rows.length === 0) {
                console.log(`\n🚨 REDISTRIBUTING: ID ${pid} | R$ ${p.transaction_amount} | ${p.description}`);
                await fixOrphan(p);
                fixedCount++;
            } else {
                process.stdout.write('.');
            }
        }

        console.log(`\n\n--- DONE. Fixed ${fixedCount} orphans. ---`);

    } catch (e) {
        console.error('ERROR:', e);
    }
}

async function fixOrphan(p) {
    const round = 7; // Target Round (Updated to 7)
    const qty = Math.floor(p.transaction_amount / 20);
    const finalQty = qty < 1 ? 1 : qty;

    // Extract user info
    const payer = p.payer || {};
    const name = payer.first_name ? `${payer.first_name} ${payer.last_name || ''}`.trim() : 'Recuperado Jogo1';
    const email = payer.email || 'recuperado@antigo.com';
    const cpf = payer.identification ? payer.identification.number : '00000000000';
    // Clean description to store as note if needed, but not critical
    const phone = '00000000000'; // Dummy phone as MP doesn't reliably give it

    console.log(`   -> Assigning ${finalQty} tickets to: ${name}`);

    // A. Find Available Tickets in Round 5
    const availableRes = await query(`
        SELECT id, number FROM az_tickets 
        WHERE campaign_id = 21 AND round_number = $1 AND status = 'AVAILABLE'
        ORDER BY number ASC
        LIMIT $2
    `, [round, finalQty]);

    if (availableRes.rows.length < finalQty) {
        console.error('   ❌ Not enough tickets available in Round 5!');
        return;
    }

    const tickets = availableRes.rows;
    const ticketNumbers = tickets.map(t => t.number);

    // B. Create Claim
    const claimRes = await query(`
        INSERT INTO az_claims 
        (campaign_id, phone, name, cpf, round_number, base_qty, extra_qty, total_qty, type, status, payment_id, claimed_at, expires_at, next_unlock_at)
        VALUES (21, $1, $2, $3, $4, $5, 0, $5, 'REDIST_R1', 'PAID', $6, NOW(), NOW() + interval '1 year', NOW())
        RETURNING id
    `, [phone, name, cpf, round, finalQty, p.id.toString()]);

    const claimId = claimRes.rows[0].id;

    // C. Assign Tickets
    for (const t of tickets) {
        await query(`
            UPDATE az_tickets 
            SET status = 'ASSIGNED', assigned_claim_id = $1, updated_at = NOW()
            WHERE id = $2
        `, [claimId, t.id]);
    }

    console.log(`   ✅ Success! Tickets: ${ticketNumbers.join(', ')}`);
}

redistribute();
