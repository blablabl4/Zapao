const { query, getClient } = require('../database/db');
const crypto = require('crypto');

class OrderService {
    constructor() {
        this.expirationMinutes = parseInt(process.env.ORDER_EXPIRATION_MINUTES || '10');
        this.maxNumbersPerPerson = 3; // Limit per person
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
     * @param {number} number - Number between 0-99
     * @param {string} buyer_ref - Buyer reference: "name|phone|birthdate|gender"
     * @param {number} draw_id - Current draw ID
     * @returns {object} Created order
     */
    async createOrder(number, buyer_ref = null, draw_id = null) {
        // Validate number
        if (!Number.isInteger(number) || number < 0 || number > 99) {
            throw new Error('Number must be between 0 and 99');
        }

        // Fixed amount: R$ 1.00 for all numbers
        const amount = 1.00;

        // Generate unique order ID
        const order_id = crypto.randomUUID();

        // Calculate expiration (10 minutes from now)
        const created_at = new Date();
        const expires_at = new Date(created_at.getTime() + this.expirationMinutes * 60 * 1000);

        const result = await query(`
            INSERT INTO orders (order_id, number, amount, status, created_at, expires_at, buyer_ref, draw_id)
            VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7)
            RETURNING *
        `, [order_id, number, amount, created_at, expires_at, buyer_ref, draw_id]);

        console.log(`[OrderService] Created order ${order_id} for number ${number.toString().padStart(2, '0')} - R$ ${amount.toFixed(2)}`);

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
        console.log(`[OrderService] Order ${order_id} status updated to ${status}`);
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
     * Get statistics
     * @returns {object} Order statistics
     */
    async getStats() {
        // Total paid orders
        const paidTotal = await query(`SELECT COUNT(*) as count FROM orders WHERE status = 'PAID'`);

        // Total revenue from paid orders
        const revenue = await query(`SELECT SUM(amount) as total FROM orders WHERE status = 'PAID'`);

        // Count by number (0-99)
        const countByNumber = [];
        for (let i = 0; i < 100; i++) {
            const result = await query(
                `SELECT COUNT(*) as count FROM orders WHERE number = $1 AND status = 'PAID'`,
                [i]
            );
            countByNumber.push(parseInt(result.rows[0].count));
        }

        return {
            paid_total: parseInt(paidTotal.rows[0].count),
            revenue_total_paid: parseFloat(revenue.rows[0].total) || 0,
            paid_count_by_number: countByNumber
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
     * @returns {Array} List of paid orders with parsed buyer data
     */
    async getPaidOrdersByNumber(number) {
        const result = await query(`
            SELECT o.*, p.paid_at 
            FROM orders o
            LEFT JOIN payments p ON o.order_id = p.order_id
            WHERE o.number = $1 AND o.status = 'PAID'
            ORDER BY p.paid_at ASC
        `, [number]);

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
                buyer: buyerData
            };
        });
    }
}

module.exports = new OrderService();
