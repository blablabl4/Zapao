const express = require('express');
const router = express.Router();
const OrderService = require('../services/OrderService');
const DrawService = require('../services/DrawService');
const { getPaymentProvider } = require('../services/PaymentProvider');
const { query } = require('../database/db');
const validateRequest = require('../middleware/validateRequest');
const { createOrderSchema } = require('../validators/orderSchema');

/**
 * POST /api/orders/affiliate-click
 * Track clicks on affiliate links
 */
router.post('/affiliate-click', async (req, res) => {
    try {
        const { referrer_id, draw_id } = req.body;

        // Silent fail if missing data (it's analytics)
        if (!referrer_id || !draw_id) return res.json({ ok: true });

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        await query(
            'INSERT INTO affiliate_clicks (referrer_id, draw_id, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
            [referrer_id, draw_id, ip, userAgent]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error('Click track error:', e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

/**
 * POST /api/orders/bulk
 * Create multiple orders with single Pix payment
 */
router.post('/bulk', validateRequest(createOrderSchema), async (req, res) => {
    try {
        const { numbers, buyer_ref, referrer_id } = req.body;

        // Validate input - UNLIMITED numbers allowed
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({ error: 'Selecione pelo menos 1 número' });
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
            // ANTI-DUPLICATE: Check for recent PENDING orders from this phone (within 60 seconds)
            const recentPending = await query(`
                SELECT order_id, created_at, number
                FROM orders
                WHERE buyer_ref LIKE $1
                AND draw_id = $2
                AND status = 'PENDING'
                AND created_at >= NOW() - INTERVAL '60 seconds'
                ORDER BY created_at DESC
                LIMIT 1
            `, [`%${phone}%`, currentDraw.id]);

            if (recentPending.rows.length > 0) {
                // Return existing pending order instead of creating new one
                const existingOrderId = recentPending.rows[0].order_id;
                console.log(`[ANTI-DUPLICATE] Phone ${phone} has pending order ${existingOrderId} from last 60s. Blocking new order.`);

                return res.status(429).json({
                    error: 'Você já tem um pedido em andamento. Aguarde o pagamento ou tente novamente em 1 minuto.',
                    existing_order_id: existingOrderId
                });
            }

            // ANTI-DUPLICATE: Check for orders created in last 60 seconds (any status)
            const recentOrders = await query(`
                SELECT COUNT(*) as count
                FROM orders
                WHERE buyer_ref LIKE $1
                AND draw_id = $2
                AND created_at >= NOW() - INTERVAL '60 seconds'
            `, [`%${phone}%`, currentDraw.id]);

            if (parseInt(recentOrders.rows[0].count) >= numbers.length) {
                console.log(`[ANTI-DUPLICATE] Phone ${phone} already created ${recentOrders.rows[0].count} orders in last 60s. Blocking.`);
                return res.status(429).json({
                    error: 'Aguarde 1 minuto antes de fazer uma nova compra.'
                });
            }
        }

        // Create unique batch ID for grouping this purchase
        const batchId = `BATCH-${Date.now()}`;
        const uniqueBuyerRef = `${buyer_ref}|${batchId}`;

        // Create all orders
        const orders = [];
        const { query: dbQuery } = require('../database/db'); // Renamed to avoid conflict

        for (const number of numbers) {
            const numValue = parseInt(number);
            // Validate each number
            // Validate range (1-150)
            const maxNum = currentDraw.total_numbers || 150;
            if (isNaN(numValue) || numValue < 1 || numValue > maxNum) {
                return res.status(400).json({
                    error: `Número inválido: ${number} (Range: 1-${maxNum})`
                });
            }

            // Locking logic: REMOVED as per user request.
            // Multiple users can buy the same number.

            const order = await OrderService.createOrder(numValue, uniqueBuyerRef, currentDraw.id, referrer_id);
            orders.push(order);
        }

        // Calculate total amount
        const totalAmount = numbers.length * 1.50;

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
        if (isNaN(numValue) || numValue < 1 || numValue > 150) {
            return res.status(400).json({ error: 'Number must be between 1 and 150' });
        }

        // Check purchase limit (Limit REMOVED)
        if (buyer_ref) {
            // Unlimited
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

/**
 * GET /api/orders/buyers/:number
 * Get all buyers for a specific number (Admin usage)
 */
router.get('/buyers/:number', async (req, res) => {
    try {
        const number = parseInt(req.params.number);
        if (isNaN(number)) {
            return res.status(400).json({ error: 'Invalid number' });
        }

        const buyers = await OrderService.getPaidOrdersByNumber(number);
        res.json({ count: buyers.length, buyers });
    } catch (error) {
        console.error('[API /orders/buyers/:number] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/orders/my-numbers/:phone
 * Get all paid numbers for a specific phone in current draw
 */
router.get('/my-numbers/:phone', async (req, res) => {
    try {
        const phone = req.params.phone.replace(/\D/g, ''); // Clean phone
        if (!phone || phone.length < 10) {
            return res.status(400).json({ error: 'Telefone inválido' });
        }

        // Get current draw
        const currentDraw = await DrawService.getCurrentDraw();

        // Query: Find all PAID orders for this phone in current draw
        const { query } = require('../database/db');
        const result = await query(`
            SELECT number, created_at 
            FROM orders 
            WHERE draw_id = $1 
              AND status = 'PAID' 
              AND buyer_ref LIKE $2
            ORDER BY number ASC
        `, [currentDraw.id, `%|${phone}|%`]);

        // Also try matching phone at different positions in buyer_ref
        const result2 = await query(`
            SELECT number, created_at 
            FROM orders 
            WHERE draw_id = $1 
              AND status = 'PAID' 
              AND buyer_ref LIKE $2
            ORDER BY number ASC
        `, [currentDraw.id, `%${phone}%`]);

        // Merge and dedupe results
        const allNumbers = [...result.rows, ...result2.rows];
        const uniqueNumbers = [...new Map(allNumbers.map(r => [r.number, r])).values()];

        res.json({
            draw_name: currentDraw.draw_name,
            phone: phone,
            numbers: uniqueNumbers.map(r => ({
                number: r.number,
                purchased_at: r.created_at
            })),
            count: uniqueNumbers.length
        });

    } catch (error) {
        console.error('[API /orders/my-numbers] Error:', error.message);
        res.status(500).json({ error: 'Erro ao buscar números' });
    }
});

module.exports = router;
