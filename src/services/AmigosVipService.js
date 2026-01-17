const { query, getClient } = require('../database/db');
const crypto = require('crypto');
const Logger = require('./LoggerService');

class AmigosVipService {
    constructor() {
        this.expirationMinutes = parseInt(process.env.ORDER_EXPIRATION_MINUTES || '10');
        this.pricePerNumber = 1.00; // R$ 1.00 por número
    }

    /**
     * Create a VIP purchase
     * @param {string} phone - Phone number
     * @param {string} name - Customer name
     * @param {number} qty - Quantity of numbers to purchase
     * @param {string} deviceId - Device identifier
     * @param {string} ip - IP address
     * @param {string} userAgent - User agent
     * @returns {object} Purchase details with payment info
     */
    async createPurchase(phone, name, pixKey, zipCode, qty, deviceId = null, ip = null, userAgent = null, affiliateId = null) {
        // Validate quantity
        if (!Number.isInteger(qty) || qty < 1 || qty > 200) {
            throw new Error('Quantidade deve ser entre 1 e 200 números');
        }

        // Get active campaign
        const campaign = await this.getActiveCampaign();
        if (!campaign) {
            throw new Error('Nenhuma campanha ativa no momento');
        }

        // Check availability
        const available = await this.getAvailableCount(campaign.id);
        if (available < qty) {
            throw new Error(`Apenas ${available} números disponíveis`);
        }

        // Calculate amount
        const amount = qty * this.pricePerNumber;

        // Generate purchase ID
        const purchaseId = `VIP-${crypto.randomUUID()}`;

        // Calculate expiration
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + this.expirationMinutes * 60 * 1000);

        // Insert purchase record
        const result = await query(`
            INSERT INTO az_vip_purchases 
            (id, campaign_id, phone, name, pix_key, zip_code, qty, amount, status, created_at, expires_at, ip, user_agent, device_id, affiliate_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [purchaseId, campaign.id, phone, name, pixKey, zipCode, qty, amount, createdAt, expiresAt, ip, userAgent, deviceId, affiliateId]);

        const purchase = result.rows[0];

        Logger.info('VIP_PURCHASE_CREATED', `Created VIP purchase ${purchaseId}`, {
            qty,
            amount,
            phone: phone.substring(0, 6) + '***'
        });

        // Generate PIX payment
        const { getPaymentProvider } = require('./PaymentProvider');
        const paymentProvider = getPaymentProvider();

        const paymentData = await paymentProvider.generatePix(purchaseId, amount, {
            name,
            phone,
            email: 'cliente@tvzapao.com.br' // Required by some providers
        });

        // Update purchase with PIX info
        await query(`
            UPDATE az_vip_purchases 
            SET pix_qr_code = $1, pix_copy_paste = $2, transaction_id = $3
            WHERE id = $4
        `, [paymentData.qr_code_base64, paymentData.qr_code, paymentData.payment_id, purchaseId]);

        return {
            purchase_id: purchaseId,
            qty,
            amount,
            expires_at: expiresAt,
            payment: paymentData
        };
    }

    /**
     * Process payment for a VIP purchase (called by PaymentService webhook)
     * @param {string} purchaseId - Purchase ID
     * @param {number} amountPaid - Amount paid
     * @returns {object} Processing result
     */
    async processPayment(purchaseId, amountPaid) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Get purchase
            const purchaseRes = await client.query(
                'SELECT * FROM az_vip_purchases WHERE id = $1',
                [purchaseId]
            );

            const purchase = purchaseRes.rows[0];
            if (!purchase) {
                throw new Error(`Purchase ${purchaseId} not found`);
            }

            // Check if already paid
            if (purchase.status === 'PAID') {
                Logger.info('VIP_ALREADY_PAID', `Purchase ${purchaseId} already paid`, null);
                await client.query('COMMIT');
                return { success: true, message: 'Already paid', numbers: [] };
            }

            // Validate amount
            const expectedAmount = parseFloat(purchase.amount);
            const paidAmount = parseFloat(amountPaid);

            if (Math.abs(paidAmount - expectedAmount) > 0.01) {
                throw new Error(`Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`);
            }

            // Allocate random numbers
            const numbers = await this.allocateRandomNumbers(
                client,
                purchase.campaign_id,
                purchase.qty,
                purchaseId
            );

            if (numbers.length !== purchase.qty) {
                throw new Error(`Failed to allocate ${purchase.qty} numbers. Got ${numbers.length}`);
            }

            // Mark as PAID
            await client.query(
                'UPDATE az_vip_purchases SET status = $1, updated_at = $2 WHERE id = $3',
                ['PAID', new Date(), purchaseId]
            );

            await client.query('COMMIT');

            Logger.info('VIP_PAYMENT_SUCCESS', `VIP purchase ${purchaseId} paid`, {
                qty: numbers.length,
                amount: paidAmount
            });

            return {
                success: true,
                message: 'Payment processed',
                numbers: numbers
            };

        } catch (error) {
            await client.query('ROLLBACK');
            Logger.error('VIP_PAYMENT_FAIL', `Error processing VIP payment: ${error.message}`, null);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Allocate random numbers from available pool
     * @param {object} client - Database client (transaction)
     * @param {number} campaignId - Campaign ID
     * @param {number} qty - Quantity to allocate
     * @param {string} purchaseId - Purchase ID
     * @returns {Array} Allocated numbers
     */
    async allocateRandomNumbers(client, campaignId, qty, purchaseId) {
        // Lock and update available tickets in one query (PostgreSQL-specific)
        const result = await client.query(`
            UPDATE az_tickets
            SET status = 'ASSIGNED',
                assigned_purchase_id = $1,
                updated_at = NOW()
            WHERE id IN (
                SELECT id FROM az_tickets
                WHERE campaign_id = $2 AND status = 'AVAILABLE'
                ORDER BY RANDOM()
                LIMIT $3
                FOR UPDATE SKIP LOCKED
            )
            RETURNING number
        `, [purchaseId, campaignId, qty]);

        return result.rows.map(r => r.number);
    }

    /**
     * Get purchased numbers for a phone number
     * @param {string} phone - Phone number
     * @returns {object} Purchase history with numbers
     */
    async getPurchasedNumbers(phone) {
        const result = await query(`
            SELECT 
                p.id,
                p.qty,
                p.amount,
                p.status,
                p.created_at,
                p.campaign_id,
                c.name as campaign_name,
                ARRAY_AGG(t.number ORDER BY t.number) as numbers
            FROM az_vip_purchases p
            LEFT JOIN az_campaigns c ON p.campaign_id = c.id
            LEFT JOIN az_tickets t ON t.assigned_purchase_id = p.id
            WHERE p.phone = $1 AND p.status = 'PAID'
            GROUP BY p.id, p.qty, p.amount, p.status, p.created_at, p.campaign_id, c.name
            ORDER BY p.created_at DESC
        `, [phone]);

        return result.rows;
    }

    /**
     * Get user profile by phone (from last purchase)
     * @param {string} phone
     * @returns {object|null}
     */
    async getUserProfile(phone) {
        const result = await query(`
            SELECT name, pix_key, zip_code 
            FROM az_vip_purchases 
            WHERE phone = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [phone]);

        return result.rows[0] || null;
    }

    /**
     * Get purchase by ID
     * @param {string} purchaseId
     * @returns {object|null}
     */
    async getPurchase(purchaseId) {
        const result = await query('SELECT * FROM az_vip_purchases WHERE id = $1', [purchaseId]);
        return result.rows[0] || null;
    }

    /**
     * Get active campaign
     * @returns {object|null}
     */
    async getActiveCampaign() {
        const result = await query(`
            SELECT * FROM az_campaigns 
            WHERE is_active = TRUE 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        return result.rows[0] || null;
    }

    /**
     * Count available numbers in campaign
     * @param {number} campaignId
     * @returns {number}
     */
    async getAvailableCount(campaignId) {
        const result = await query(`
            SELECT COUNT(*) as count 
            FROM az_tickets 
            WHERE campaign_id = $1 AND status = 'AVAILABLE'
        `, [campaignId]);
        return parseInt(result.rows[0].count);
    }

    /**
     * Mark expired purchases
     * @returns {number} Count of expired purchases
     */
    async markExpiredPurchases() {
        const now = new Date();
        const result = await query(`
            UPDATE az_vip_purchases 
            SET status = 'EXPIRED'
            WHERE status = 'PENDING' AND expires_at <= $1
            RETURNING id
        `, [now]);

        if (result.rowCount > 0) {
            Logger.info('VIP_EXPIRED', `Marked ${result.rowCount} VIP purchases as expired`, null);
        }

        return result.rowCount;
    }
}

module.exports = new AmigosVipService();
