const { query, getClient } = require('../database/db');
const crypto = require('crypto');
const Logger = require('./LoggerService');

class OrderService {
    constructor() {
        this.expirationMinutes = parseInt(process.env.ORDER_EXPIRATION_MINUTES || '10');
        this.maxNumbersPerPerson = 3; // Limit per person (Removed in logic but kept prop)
    }

    /**
     * Count how many numbers a person has purchased (by phone)
     * @param {string} phone - Phone number from buyer_ref
     * @returns {number} Count of paid orders
     */
    async countPurchasesByPhone(phone) {
        if (!phone) return 0;

        const result = await query(`
            SELECT COUNT(*) as count
            FROM orders
            WHERE status = 'PAID'
              AND buyer_ref LIKE $1
        `, [`%${phone}%`]);

        return parseInt(result.rows[0].count);
    }

    /**
     * Create a new order
     * @param {number} number - Number between 1-150
     * @param {string} buyer_ref - Buyer reference: "name|phone|birthdate|gender"
     * @param {number} draw_id - Current draw ID
     * @returns {object} Created order
     */
    async createOrder(number, buyer_ref = null, draw_id = null, referrer_id = null) {
        // Validate number
        if (!Number.isInteger(number) || number < 1 || number > 150) {
            throw new Error('Number must be between 1 and 150');
        }

        // Fixed amount: R$ 1.50 for all numbers
        const amount = 1.50;

        // Unlimited numbers logic: We allow multiple orders for the same number
        // No availability check needed.

        // Generate unique order ID
        const order_id = crypto.randomUUID();

        // Calculate expiration (10 minutes from now)
        const created_at = new Date();
        const expires_at = new Date(created_at.getTime() + this.expirationMinutes * 60 * 1000);

        const result = await query(`
            INSERT INTO orders (order_id, number, amount, status, created_at, expires_at, buyer_ref, draw_id, referrer_id)
            VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7, $8)
            RETURNING *
        `, [order_id, number, amount, created_at, expires_at, buyer_ref, draw_id, referrer_id]);

        Logger.info('ORDER_CREATED', `Order ${order_id} created`, { number, amount, drawId: draw_id });

        return result.rows[0];
    }

    /**
     * Get order by ID
     * @param {string} order_id
     * @returns {object|null}
     */
    async getOrder(order_id) {
        const result = await query('SELECT * FROM orders WHERE order_id = $1', [order_id]);
        return result.rows[0] || null;
    }

    /**
     * Update order status
     * @param {string} order_id
     * @param {string} status - PENDING, PAID, EXPIRED
     */
    async updateOrderStatus(order_id, status) {
        await query('UPDATE orders SET status = $1 WHERE order_id = $2', [status, order_id]);
        Logger.info('ORDER_STATUS_UPDATE', `Order ${order_id} -> ${status}`, { orderId: order_id, status });
    }

    /**
     * Update status for all orders in a batch (grouped by buyer_ref)
     * @param {string} buyer_ref
     * @param {string} status
     */
    async updateBatchStatus(buyer_ref, status) {
        const result = await query('UPDATE orders SET status = $1 WHERE buyer_ref = $2 RETURNING order_id', [status, buyer_ref]);
        Logger.info('BATCH_STATUS_UPDATE', `Updated ${result.rowCount} orders to ${status}`, { buyer_ref, count: result.rowCount });
        return result.rowCount;
    }

    /**
     * Get expired orders
     * @returns {Array} Expired orders
     */
    async getExpiredOrders() {
        const now = new Date();
        const result = await query(`
            SELECT * FROM orders 
            WHERE status = 'PENDING' AND expires_at <= $1
        `, [now]);
        return result.rows;
    }

    /**
     * Get statistics for a specific draw
     * @param {number} drawId - Draw ID to filter by (null = all)
     * @returns {object} Order statistics
     */
    async getStats(drawId = null) {
        let whereClause = "WHERE status = 'PAID'";
        let params = [];

        if (drawId) {
            whereClause += " AND draw_id = $1";
            params = [drawId];
        }

        // Total paid orders (Tickets/Numbers count)
        const paidTotal = await query(`SELECT COUNT(*) as count FROM orders ${whereClause}`, params);

        // Transactions Count (Unique Payments/Webhooks)
        // Join payments to count unique txid or event_hash
        // Note: whereClause uses filtered columns, need to alias orders if ambiguous, but here params are simple.
        // We'll use a subquery or join.
        // orders table has no prefix in whereClause (e.g. "WHERE draw_id = $1")
        const transactions = await query(`
            SELECT COUNT(DISTINCT p.txid) as count 
            FROM orders o
            JOIN payments p ON o.order_id = p.order_id
            ${whereClause.replace('WHERE', 'WHERE o.')}
        `, params);

        // Total revenue from REAL PAYMENTS
        const revenue = await query(`
            SELECT COALESCE(SUM(p.amount_paid), 0) as total 
            FROM orders o 
            JOIN payments p ON o.order_id = p.order_id
            ${whereClause.replace('WHERE', 'WHERE o.')}
        `, params);

        // Unique Customers
        const unique = await query(`
            SELECT COUNT(DISTINCT split_part(buyer_ref, '|', 2)) as count 
            FROM orders ${whereClause}
        `, params);

        return {
            paid_total: parseInt(paidTotal.rows[0].count), // Tickets/Cotas
            transactions_total: parseInt(transactions.rows[0].count) || 0, // MP Sales
            revenue_total_paid: parseFloat(revenue.rows[0].total) || 0,
            unique_customers: parseInt(unique.rows[0].count) || 0
        };
    }

    /**
     * Mark expired orders
     * @returns {number} Count of expired orders
     */
    async markExpiredOrders() {
        const expiredOrders = await this.getExpiredOrders();

        for (const order of expiredOrders) {
            await this.updateOrderStatus(order.order_id, 'EXPIRED');
        }

        return expiredOrders.length;
    }

    /**
     * Get paid orders for a specific number with buyer details
     * @param {number} number
     * @param {number} drawId (Optional) Filter by specific draw
     * @returns {Array} List of paid orders with parsed buyer data
     */
    async getPaidOrdersByNumber(number, drawId = null) {
        let queryStr = `
            SELECT o.*, 
                   COALESCE(p.paid_at, o.created_at) as paid_at,
                   d.draw_name
            FROM orders o
            LEFT JOIN payments p ON o.order_id = p.order_id
            JOIN draws d ON o.draw_id = d.id
            WHERE o.number = $1 AND o.status = 'PAID'
        `;

        const params = [number];
        if (drawId) {
            queryStr += ` AND o.draw_id = $2 ORDER BY COALESCE(p.paid_at, o.created_at) DESC`;
            params.push(drawId);
        } else {
            queryStr += ` ORDER BY COALESCE(p.paid_at, o.created_at) DESC`;
        }

        const result = await query(queryStr, params);

        const orders = result.rows;

        // Parse buyer_ref to extract data
        return orders.map(order => {
            let buyerData = {
                name: '',
                phone: '',
                birthdate: '',
                gender: ''
            };

            if (order.buyer_ref) {
                try {
                    // Format: "name|phone|birthdate|gender"
                    const parts = order.buyer_ref.split('|');
                    if (parts.length >= 2) {
                        buyerData.name = parts[0] || '';
                        buyerData.phone = parts[1] || '';
                        buyerData.birthdate = parts[2] || '';
                        buyerData.gender = parts[3] || '';
                    }
                } catch (e) {
                    console.error('Error parsing buyer_ref:', e);
                }
            }

            return {
                ...order,
                buyer: buyerData,
                draw_name: order.draw_name // Pass through
            };
        });
    }

    /**
     * Get all orders for a specific draw
     * @param {number} drawId
     * @returns {Array} Orders for draw
     */
    async getOrdersByDraw(drawId) {
        const result = await query(`
            SELECT * FROM orders 
            WHERE draw_id = $1
            ORDER BY created_at DESC
        `, [drawId]);
        return result.rows;
    }
}

module.exports = new OrderService();
