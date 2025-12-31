const { MercadoPagoConfig, Payment } = require('mercadopago');
const { query } = require('./src/database/db');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

// Start searching from 19:00 BRT (22:00 UTC) to capture everything from "today's session"
const START_TIME = '2025-12-30T22:00:00Z';

async function reconcileAndFix() {
    console.log(`--- Reconcile & Fix Orphans (Since ${START_TIME}) ---`);

    try {
        // 1. Fetch Approved Payments from MP
        console.log('Fetching MP payments...');
        const history = await payment.search({
            options: {
                sort: 'date_created',
                criteria: 'asc',
                range: 'date_created',
                begin_date: START_TIME,
                end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // NOW + 1 day buffer
                status: 'approved',
                limit: 100
            }
        });

        const mpPayments = history.results || [];
        console.log(`MP found: ${mpPayments.length} approved payments.`);

        // 2. Process each payment
        for (const p of mpPayments) {
            const pid = p.id.toString();
            // Check if exists in claims
            const check = await query("SELECT id FROM az_claims WHERE payment_id = $1", [pid]);

            if (check.rows.length > 0) {
                // Already handled
                process.stdout.write('.');
                continue;
            }

            console.log(`\n🚨 ORPHAN FOUND: ID ${pid} | Value: ${p.transaction_amount} | ${p.description}`);

            // 3. Fix Orphan (Assign to Round 5)
            await fixOrphan(p);
        }
        console.log('\n--- Done ---');

    } catch (e) {
        console.error('ERROR:', e);
    }
}

async function fixOrphan(p) {
    const round = 5; // Force current round
    const qty = Math.floor(p.transaction_amount / 20); // 20.00 per ticket assumption (or 0.03 for tests? Force min 1)
    const finalQty = qty < 1 ? 1 : qty; // Safety for tests

    // Extract user info
    const payer = p.payer || {};
    const name = payer.first_name ? `${payer.first_name} ${payer.last_name || ''}`.trim() : 'Recuperado MP';
    const email = payer.email || 'noemail@recuperado.com';
    const cpf = payer.identification ? payer.identification.number : '00000000000';
    // Phone logic? MP might not give phone in standard search. Use dummy if missing.
    // Try to parse phone from logic if possible, else dummy.
    const phone = '00000000000';

    console.log(`   -> Assigning ${finalQty} tickets to: ${name} (Round ${round})`);

    // A. Find Available Tickets
    const availableRes = await query(`
        SELECT id, number FROM az_tickets 
        WHERE campaign_id = 21 AND round_number = $1 AND status = 'AVAILABLE'
        ORDER BY number ASC
        LIMIT $2
    `, [round, finalQty]);

    if (availableRes.rows.length < finalQty) {
        console.error('   ❌ Not enough tickets available to fix this orphan!');
        return;
    }

    const tickets = availableRes.rows;
    const ticketNumbers = tickets.map(t => t.number);

    // B. Create Claim
    const claimRes = await query(`
        INSERT INTO az_claims 
        (campaign_id, phone, name, cpf, round_number, base_qty, extra_qty, total_qty, type, status, payment_id, claimed_at, expires_at, next_unlock_at)
        VALUES (21, $1, $2, $3, $4, $5, 0, $5, 'RECOVERY', 'PAID', $6, NOW(), NOW() + interval '1 year', NOW())
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

    console.log(`   ✅ Fixed! Assigned Tickets: ${ticketNumbers.join(', ')}`);
}

reconcileAndFix();
