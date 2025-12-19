const express = require('express');
const router = express.Router();
const OrderService = require('../services/OrderService');
const DrawService = require('../services/DrawService');
const { getPaymentProvider } = require('../services/PaymentProvider');

/**
 * POST /api/orders/bulk
 * Create multiple orders with single Pix payment
 */
router.post('/bulk', async (req, res) => {
    try {
        const { numbers, buyer_ref } = req.body;

        // Validate input
        if (!Array.isArray(numbers) || numbers.length === 0 || numbers.length > 3) {
            return res.status(400).json({ error: 'Selecione 1 a 3 números' });
        }

        if (!buyer_ref) {
            return res.status(400).json({ error: 'Dados do comprador são obrigatórios' });
        }

        // Get current draw
        const currentDraw = await DrawService.getCurrentDraw();

        // Check if sales are locked
        if (currentDraw.sales_locked) {
            return res.status(403).json({ error: 'Vendas encerradas' });
        }

        // Extract phone for limit check
        const parts = buyer_ref.split('|');
        const phone = parts[1];

        if (phone) {
            const purchaseCount = await OrderService.countPurchasesByPhone(phone);
            if (purchaseCount + numbers.length > 3) {
                return res.status(403).json({
                    error: 'Limite excedido',
                    message: `Você já tem ${purchaseCount} número(s). Pode comprar apenas ${3 - purchaseCount} mais.`
                });
            }
        }

        // Create all orders
        const orders = [];
        for (const number of numbers) {
            const numValue = parseInt(number);
            if (isNaN(numValue) || numValue < 0 || numValue > 99) {
                return res.status(400).json({ error: `Número inválido: ${number}` });
            }

            const order = await OrderService.createOrder(numValue, buyer_ref, currentDraw.id);
            orders.push(order);
        }

        // Calculate total amount
        const totalAmount = numbers.length * 1.00;

        // Extract buyer info for transaction description
        const buyerInfo = {
            name: parts[0] || 'Cliente',
            phone: phone
        };

        // Generate SINGLE Pix for all orders
        const paymentProvider = getPaymentProvider();

        // Use first order ID as primary reference (InfinitePay doesn't like commas)
        // Store all order IDs in the response for webhook processing
        const primaryOrderId = orders[0].order_id;
        const allOrderIds = orders.map(o => o.order_id);

        // Pass buyer info to provider
        const pixData = await paymentProvider.generatePix(primaryOrderId, totalAmount, buyerInfo);

        // Return all orders + single Pix
        res.status(201).json({
            orders: orders.map(o => ({
                order_id: o.order_id,
                number: o.number,
                amount: parseFloat(o.amount),
                status: o.status,
                expires_at: o.expires_at
            })),
            totalAmount: totalAmount,
            qr_image_data_url: pixData.qr_image_data_url,
            pix_copy_paste: pixData.pix_copy_paste,
            checkout_url: pixData.checkout_url, // For InfinitePay redirect
            expires_at: orders[0].expires_at,
            combined_order_id: allOrderIds.join(','), // Keep for webhook
            primary_order_id: primaryOrderId
        });

    } catch (error) {
        console.error('[API /orders/bulk] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/orders
 * Create a single order
 */
router.post('/', async (req, res) => {
    try {
        const { number, buyer_ref } = req.body;

        // Get current draw
        const currentDraw = await DrawService.getCurrentDraw();

        // Check if sales are locked
        if (currentDraw.sales_locked) {
            return res.status(403).json({ error: 'Sales are currently locked' });
        }

        // Validate input
        if (number === undefined || number === null) {
            return res.status(400).json({ error: 'Number is required' });
        }

        const numValue = parseInt(number);
        if (isNaN(numValue) || numValue < 0 || numValue > 99) {
            return res.status(400).json({ error: 'Number must be between 0 and 99' });
        }

        // Check purchase limit (3 per person)
        if (buyer_ref) {
            const parts = buyer_ref.split('|');
            const phone = parts[1];

            if (phone) {
                const purchaseCount = await OrderService.countPurchasesByPhone(phone);
                if (purchaseCount >= 3) {
                    return res.status(403).json({
                        error: 'Limite atingido',
                        message: 'Você já comprou 3 números. Limite máximo por pessoa.'
                    });
                }
            }
        }

        // Create order
        const order = await OrderService.createOrder(numValue, buyer_ref || null, currentDraw.id);

        // Generate Pix payment
        const paymentProvider = getPaymentProvider();
        const pixData = await paymentProvider.generatePix(order.order_id, order.amount);

        // Return order with payment data
        res.status(201).json({
            order_id: order.order_id,
            number: order.number,
            amount: parseFloat(order.amount),
            status: order.status,
            expires_at: order.expires_at,
            qr_image_data_url: pixData.qr_image_data_url,
            pix_copy_paste: pixData.pix_copy_paste
        });

    } catch (error) {
        console.error('[API /orders] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Rest of routes unchanged...
/**
 * GET /api/orders/:orderId
 * Get order status
 */
router.get('/:orderId', async (req, res) => {
    try {
        const order = await OrderService.getOrder(req.params.orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            order_id: order.order_id,
            number: order.number,
            amount: parseFloat(order.amount),
            status: order.status,
            created_at: order.created_at,
            expires_at: order.expires_at
        });
    } catch (error) {
        console.error('[API /orders/:orderId] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/orders/stats/global
 * Get global statistics about paid orders by number
 */
router.get('/stats/global', async (req, res) => {
    try {
        const stats = await OrderService.getStats();
        res.json(stats);
    } catch (error) {
        console.error('[API /orders/stats/global] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
