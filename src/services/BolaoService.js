const { query, getClient } = require('../database/db');
const { MercadoPagoConfig, Payment } = require('mercadopago');

// Initialize MP Client (renamed to avoid shadowing with DB client)
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || '' });

class BolaoService {

    /**
     * Get the Active Bolão Campaign
     */
    async getActiveBolao() {
        const res = await query(`
            SELECT * FROM az_campaigns 
            WHERE type = 'BOLAO' AND is_active = true 
            ORDER BY created_at DESC LIMIT 1
        `);
        return res.rows[0];
    }

    /**
     * Get Grid Status for Current Round
     */
    async getGrid() {
        const campaign = await this.getActiveBolao();
        if (!campaign) throw new Error('Bolão não ativo.');

        const round = campaign.current_round || 1;

        // Fetch Claims for this Round
        const res = await query(`
            SELECT t.number, t.status as ticket_status, c.name, c.phone, c.status as claim_status
            FROM az_tickets t
            LEFT JOIN az_claims c ON t.assigned_claim_id = c.id
            WHERE t.campaign_id = $1 AND t.round_number = $2
        `, [campaign.id, round]);

        const ticketsMap = {};
        res.rows.forEach(r => {
            ticketsMap[r.number] = r;
        });

        const grid = [];
        for (let i = 1; i <= 100; i++) {
            const t = ticketsMap[i];
            let status = 'AVAILABLE';
            let owner = null;

            if (t) {
                if (t.ticket_status === 'ASSIGNED') {
                    // Check Claim Status
                    if (t.claim_status === 'PAID') status = 'PAID';
                    else if (t.claim_status === 'PENDING') status = 'PENDING';
                    else status = 'AVAILABLE'; // Expired
                }
            }

            if (status !== 'AVAILABLE' && t && t.name) {
                // Mask Name: "João (...1234)"
                const firstName = t.name.split(' ')[0];
                const phoneTail = t.phone ? t.phone.slice(-4) : '****';
                owner = `${firstName} (...${phoneTail})`;
            }

            grid.push({ number: i, status, owner });
        }

        return {
            round,
            price: campaign.price || 20.00,
            grid
        };
    }

    /**
     * Lookup User Info by Phone
     */
    async lookupUser(phone) {
        const cleanPhone = phone.replace(/\D/g, '');
        // Search in previous claims
        const res = await query(`
            SELECT name, cpf FROM az_claims 
            WHERE phone = $1 AND cpf IS NOT NULL 
            ORDER BY claimed_at DESC LIMIT 1
        `, [cleanPhone]);
        return res.rows[0] || null;
    }

    /**
     * Initiate Checkout (Multi-Number Support)
     */
    async checkout(phone, name, cpf, numbers) {
        if (!Array.isArray(numbers) || numbers.length === 0) throw new Error('Nenhum número selecionado.');

        // Sanitize Inputs
        const cleanPhone = phone.replace(/\D/g, '');
        const cleanCpf = cpf.replace(/\D/g, '');

        if (!cleanPhone || cleanPhone.length < 10) throw new Error('Telefone inválido (use DDD + Número).');
        if (!cleanCpf || cleanCpf.length !== 11) throw new Error('CPF deve ter 11 dígitos.');

        const client = await getClient();
        try {
            await client.query('BEGIN');

            const campaign = await this.getActiveBolao();
            if (!campaign) throw new Error('Bolão inativo.');
            const round = campaign.current_round || 1;
            const singlePrice = parseFloat(campaign.price || 20.00);

            // 1. Process Tickets
            const ticketIds = [];

            // Sort numbers to avoid deadlocks
            numbers.sort((a, b) => a - b);

            for (const num of numbers) {
                // Check Availability (Lock)
                const ticketRes = await client.query(`
                    SELECT id FROM az_tickets 
                    WHERE campaign_id = $1 AND round_number = $2 AND number = $3
                    FOR UPDATE
                `, [campaign.id, round, num]);

                let ticketId;
                if (ticketRes.rows.length === 0) {
                    // Lazy create
                    const newT = await client.query(`
                        INSERT INTO az_tickets (campaign_id, number, round_number, status)
                        VALUES ($1, $2, $3, 'AVAILABLE')
                        RETURNING id
                     `, [campaign.id, num, round]);
                    ticketId = newT.rows[0].id;
                } else {
                    ticketId = ticketRes.rows[0].id;
                    // Check status
                    const tCheck = await client.query(`
                        SELECT t.status, c.status as claim_status, c.expires_at 
                        FROM az_tickets t
                        LEFT JOIN az_claims c ON t.assigned_claim_id = c.id
                        WHERE t.id = $1
                    `, [ticketId]);

                    const curr = tCheck.rows[0];
                    if (curr.status === 'ASSIGNED') {
                        if (curr.claim_status === 'PAID') throw new Error(`Número ${num} já vendido.`);
                        if (curr.claim_status === 'PENDING' && new Date() < new Date(curr.expires_at)) {
                            throw new Error(`Número ${num} reservado.`);
                        }
                    }
                }
                ticketIds.push(ticketId);
            }

            // 2. Generate Mercado Pago PIX (One for Total)
            const payment = new Payment(mpClient);
            const totalAmount = singlePrice * numbers.length;
            const description = `Bolao Jogo #${round} Qtd ${numbers.length} Nums [${numbers.join(',')}]`;

            let paymentData;
            try {
                paymentData = await payment.create({
                    body: {
                        transaction_amount: totalAmount,
                        description: description.substring(0, 250), // Limit char length
                        payment_method_id: 'pix',
                        payer: {
                            email: `${cleanPhone}@tvzapao.com.br`,
                            first_name: name.split(' ')[0],
                            last_name: name.split(' ').slice(1).join(' ') || 'Cliente',
                            identification: {
                                type: 'CPF',
                                number: cleanCpf
                            }
                        },
                        notification_url: 'https://tvzapao.com.br/api/bolao/webhook'
                    }
                });
            } catch (mpErr) {
                console.error('[Mercado Pago Error]', JSON.stringify(mpErr, null, 2));
                const msg = mpErr.message || 'Erro Desconhecido';
                const detail = mpErr.cause && mpErr.cause[0] && mpErr.cause[0].description ? mpErr.cause[0].description : '';
                throw new Error(`Falha MP: ${msg} ${detail}`);
            }

            // 3. Create Pending Claim (One Claim for Multiple tickets)
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

            const claimRes = await client.query(`
                INSERT INTO az_claims 
                (campaign_id, phone, name, cpf, round_number, base_qty, extra_qty, total_qty, type, status, payment_id, qr_code, qr_code_base64, expires_at, next_unlock_at)
                VALUES ($1, $2, $3, $4, $5, $6, 0, $6, 'BOLAO', 'PENDING', $7, $8, $9, $10, NOW())
                RETURNING id
            `, [campaign.id, cleanPhone, name, cleanCpf, round, numbers.length, paymentData.id.toString(), paymentData.point_of_interaction.transaction_data.qr_code, paymentData.point_of_interaction.transaction_data.qr_code_base64, expiresAt]);

            const claimId = claimRes.rows[0].id;

            // 4. Assign Tickets to Claim
            for (const tid of ticketIds) {
                await client.query(`
                    UPDATE az_tickets 
                    SET status = 'ASSIGNED', assigned_claim_id = $1, updated_at = NOW()
                    WHERE id = $2
                `, [claimId, tid]);
            }

            await client.query('COMMIT');

            return {
                claimId,
                paymentId: paymentData.id,
                qrCode: paymentData.point_of_interaction.transaction_data.qr_code,
                qrCodeBase64: paymentData.point_of_interaction.transaction_data.qr_code_base64,
                expiresAt,
                totalAmount
            };

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Check Rotation (Auto New Round)
     */
    async checkRotation(campaignId) {
        // Verify if 100 tickets are PAID for current round
        const campaignRes = await query('SELECT current_round FROM az_campaigns WHERE id = $1', [campaignId]);
        const round = campaignRes.rows[0].current_round;

        const countRes = await query(`
             SELECT COUNT(*) as c FROM az_tickets t
             JOIN az_claims c ON t.assigned_claim_id = c.id
             WHERE t.campaign_id = $1 AND t.round_number = $2 AND c.status = 'PAID'
        `, [campaignId, round]);

        const sold = parseInt(countRes.rows[0].c);
        if (sold >= 100) {
            console.log(`[Bolão] Round ${round} COMPLETED! Starting Round ${round + 1}`);
            await query('UPDATE az_campaigns SET current_round = current_round + 1 WHERE id = $1', [campaignId]);
            // Optional: Notify Admin
        }
    }

    async processWebhook(paymentId) {
        // Since we initialized mpClient with global token, use it.
        const payment = new Payment(mpClient);
        try {
            const data = await payment.get({ id: paymentId });

            if (data.status === 'approved') {
                console.log(`[Webhook] Payment ${paymentId} APPROVED`);

                // Update Claim
                const res = await query(`
                    UPDATE az_claims 
                    SET status = 'PAID' 
                    WHERE payment_id = $1 AND status != 'PAID'
                    RETURNING id, campaign_id, round_number
                `, [paymentId.toString()]); // Ensure string

                if (res.rows.length > 0) {
                    const { campaign_id, round_number } = res.rows[0];
                    // Trigger Rotation logic
                    await this.checkRotation(campaign_id);
                }
            } else {
                console.log(`[Webhook] Payment ${paymentId} status: ${data.status}`);
            }
        } catch (e) {
            console.error('[Webhook Error]', e);
        }
    }
}

module.exports = new BolaoService();
