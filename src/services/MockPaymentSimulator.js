const OrderService = require('./OrderService');
const PaymentService = require('./PaymentService');
const crypto = require('crypto');

class MockPaymentSimulator {
    /**
     * Simulate a payment for testing purposes
     * Generates a mock webhook event and processes it
     * @param {string} order_id
     * @returns {object} Simulation result
     */
    simulatePayment(order_id) {
        console.log(`[MockPaymentSimulator] Simulating payment for order ${order_id}`);

        // Get order
        const order = OrderService.getOrder(order_id);
        if (!order) {
            throw new Error(`Order not found: ${order_id}`);
        }

        if (order.status === 'PAID') {
            return {
                success: false,
                message: 'Order already paid'
            };
        }

        if (order.status === 'EXPIRED') {
            return {
                success: false,
                message: 'Order has expired'
            };
        }

        // Generate mock webhook payload
        const mockWebhookPayload = {
            order_id: order_id,
            amount_paid: order.amount,
            txid: `MOCK-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
            e2eid: `E2E-${crypto.randomBytes(16).toString('hex').toUpperCase()}`,
            provider: 'MockProvider',
            paid_at: new Date().toISOString(),
            event_type: 'payment.approved'
        };

        // Process through the same webhook flow
        const result = PaymentService.processWebhook(mockWebhookPayload);

        console.log(`[MockPaymentSimulator] Simulation complete for order ${order_id}`);

        return result;
    }
}

module.exports = new MockPaymentSimulator();
