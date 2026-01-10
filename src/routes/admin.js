const express = require('express');
const router = express.Router();
const DrawService = require('../services/DrawService');
const OrderService = require('../services/OrderService');

/**
 * GET /api/admin/stats
 * Get admin statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await DrawService.getAdminStats();
        res.json(stats);

    } catch (error) {
        console.error('[Admin API] Error getting stats:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/winners-history
 * Get global history of winners
 */
router.get('/winners-history', async (req, res) => {
    try {
        const history = await DrawService.getAllWinners();
        res.json({ winners: history });
    } catch (error) {
        console.error('[Admin API] Error getting winners history:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/close-draw
 * Close current draw and declare winner
 */
router.post('/close-draw', async (req, res) => {
    try {
        const { drawn_number } = req.body;

        if (drawn_number === undefined || drawn_number === null) {
            return res.status(400).json({ error: 'drawn_number is required' });
        }

        const numValue = parseInt(drawn_number);
        if (isNaN(numValue) || numValue < 1 || numValue > 150) {
            return res.status(400).json({ error: 'drawn_number must be between 1 and 150' });
        }

        const result = await DrawService.closeDraw(numValue);

        res.json(result);

    } catch (error) {
        console.error('[Admin API] Error closing draw:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/toggle-sales
 * Toggle sales lock
 */
router.post('/toggle-sales', async (req, res) => {
    try {
        const { locked } = req.body;

        if (typeof locked !== 'boolean') {
            return res.status(400).json({ error: 'locked must be a boolean' });
        }

        const draw = await DrawService.toggleSalesLock(locked);

        res.json({
            success: true,
            sales_locked: draw.sales_locked,
            lock_time: draw.lock_time
        });

    } catch (error) {
        console.error('[Admin API] Error toggling sales:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/toggle-pause
 * Toggle PAUSE status
 */
router.post('/toggle-pause', async (req, res) => {
    try {
        const { paused } = req.body;

        if (typeof paused !== 'boolean') {
            return res.status(400).json({ error: 'paused must be a boolean' });
        }

        const draw = await DrawService.togglePause(paused);

        res.json({
            success: true,
            draw: draw
        });

    } catch (error) {
        console.error('[Admin API] Error toggling pause:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/migrate-affiliate
 * Temporary endpoint to run DB migration
 */
router.get('/migrate-affiliate', async (req, res) => {
    try {
        const { query } = require('../database/db');
        await query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS referrer_id TEXT;');
        res.json({ success: true, message: 'Migration successful: referrer_id column added' });
    } catch (error) {
        console.error('Migration failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/start-draw
 * Start a new draw with scheduled end time
 */
router.post('/start-draw', async (req, res) => {
    try {
        const { draw_name, prize_base, scheduled_date, scheduled_time } = req.body;

        if (!draw_name) {
            return res.status(400).json({ error: 'draw_name is required' });
        }

        const prizeValue = parseFloat(prize_base || process.env.PRIZE_BASE_AMOUNT || '100.00');
        const startTime = new Date();

        // Calculate end_time from scheduled date/time if provided
        let endTime;
        if (scheduled_date && scheduled_time) {
            // Parse as São Paulo timezone (UTC-3)
            endTime = new Date(`${scheduled_date}T${scheduled_time}:00-03:00`);
        } else {
            // Default: 1 hour from now
            endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        }

        const draw = await DrawService.startDrawWithEndTime(draw_name, prizeValue, startTime, endTime);

        res.json({
            success: true,
            draw: {
                id: draw.id,
                draw_name: draw.draw_name,
                prize_base: parseFloat(draw.prize_base),
                current_prize: draw.current_prize,
                start_time: draw.start_time,
                end_time: draw.end_time
            }
        });

    } catch (error) {
        console.error('[Admin API] Error starting draw:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/payments
 * List all payments for current draw
 */
router.get('/payments', async (req, res) => {
    try {
        const currentDraw = await DrawService.getCurrentDraw();
        const payments = await OrderService.getOrdersByDraw(currentDraw.id);

        res.json({
            draw_id: currentDraw.id,
            draw_name: currentDraw.draw_name,
            payments: payments.map(p => ({
                order_id: p.order_id,
                number: p.number,
                buyer_name: p.buyer_ref ? p.buyer_ref.split('|')[0] : 'N/A',
                buyer_phone: p.buyer_ref ? p.buyer_ref.split('|')[1] : 'N/A',
                buyer_bairro: p.buyer_ref ? p.buyer_ref.split('|')[3] : 'Bairro',
                amount: parseFloat(p.amount),
                status: p.status,
                created_at: p.created_at,
                paid_at: p.paid_at
            }))
        });

    } catch (error) {
        console.error('[Admin API] Error getting payments:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/edit-draw
 * Edit current draw's end_time and prize
 */
router.post('/edit-draw', async (req, res) => {
    try {
        const { scheduled_date, scheduled_time, prize_base } = req.body;

        if (!scheduled_date || !scheduled_time) {
            return res.status(400).json({ error: 'Data e hora são obrigatórios' });
        }

        // Parse as São Paulo timezone (UTC-3)
        const newEndTime = new Date(`${scheduled_date}T${scheduled_time}:00-03:00`);

        const draw = await DrawService.updateCurrentDraw({
            end_time: newEndTime,
            prize_base: prize_base ? parseFloat(prize_base) : undefined
        });

        res.json({
            success: true,
            draw: {
                id: draw.id,
                draw_name: draw.draw_name,
                end_time: draw.end_time,
                prize_base: parseFloat(draw.prize_base)
            }
        });

    } catch (error) {
        console.error('[Admin API] Error editing draw:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/winners
 * Get past winners (for popup display)
 */
router.get('/winners', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;

        // Get winners from closed draws
        const { query } = require('../database/db');
        const result = await query(`
            SELECT o.buyer_ref, d.draw_name, d.closed_at
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            WHERE o.status = 'PAID' 
              AND o.number = d.drawn_number
              AND d.status = 'CLOSED'
            ORDER BY d.closed_at DESC
            LIMIT $1
        `, [limit]);

        const winners = result.rows.map(row => {
            const parts = row.buyer_ref ? row.buyer_ref.split('|') : [];
            return {
                name: parts[0] || 'Ganhador',
                bairro: parts[3] || '',
                cidade: parts[4] || ''
            };
        });

        res.json({ winners });

    } catch (error) {
        console.error('[Admin API] Error getting winners:', error.message);
        res.json({ winners: [] });
    }
});

/**
 * GET /api/admin/affiliate-stats
 * Get stats for affiliate draw (candidate list and counts)
 */
router.get('/affiliate-stats', async (req, res) => {
    try {
        const currentDraw = await DrawService.getCurrentDraw();
        const stats = await DrawService.getAffiliateStats(currentDraw.id);

        res.json({
            draw_id: currentDraw.id,
            draw_name: currentDraw.draw_name,
            total_candidates: stats.length,
            candidates: stats
        });
    } catch (error) {
        console.error('[Admin API] Error getting affiliate stats:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/affiliate-draw
 * Perform secondary draw for affiliates
 * Accepts optional draw_id in body, defaults to current draw
 */
router.post('/affiliate-draw', async (req, res) => {
    try {
        let drawId = req.body.draw_id;

        if (!drawId) {
            const currentDraw = await DrawService.getCurrentDraw();
            if (!currentDraw) {
                return res.status(400).json({ error: 'Nenhuma rifa ativa' });
            }
            drawId = currentDraw.id;
        }

        const result = await DrawService.performAffiliateDraw(drawId);

        res.json({
            success: true,
            draw_id: drawId,
            result: result
        });
    } catch (error) {
        console.error('[Admin API] Error performing affiliate draw:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/close-draw
 * Manually close the draw with a specific winning number
 */
router.post('/close-draw', async (req, res) => {
    try {
        const { number } = req.body;
        const winningNumber = parseInt(number);

        if (isNaN(winningNumber)) {
            return res.status(400).json({ error: 'Número inválido' });
        }

        const result = await DrawService.closeDraw(winningNumber);

        res.json({
            success: true,
            draw: result
        });

    } catch (error) {
        console.error('[Admin API] Error closing draw:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/draw-secret
 * Generates a biased random number based on sales ranking +30% rule.
 * Does NOT close the draw, just returns the number for the visual roulette.
 */
router.get('/draw-secret', async (req, res) => {
    try {
        const currentDraw = await DrawService.getCurrentDraw();

        if (!currentDraw) {
            return res.status(400).json({ error: 'Nenhuma rifa ativa' });
        }

        const number = await DrawService.getWeightedDrawResult(currentDraw.id);

        res.json({ success: true, number: number });

    } catch (error) {
        console.error('[Admin API] Secret Draw Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/ranking
 * Get top selling numbers
 */
router.get('/ranking', async (req, res) => {
    try {
        const currentDraw = await DrawService.getCurrentDraw();
        const { query } = require('../database/db');

        const result = await query(`
            SELECT number, COUNT(*) as sales_count
            FROM orders 
            WHERE draw_id = $1 AND status = 'PAID'
            GROUP BY number
            ORDER BY sales_count DESC
        `, [currentDraw.id]);

        res.json({
            draw_name: currentDraw.draw_name,
            ranking: result.rows
        });

    } catch (error) {
        console.error('[Admin API] Error getting ranking:', error.message);
        res.status(500).json({ error: error.message });
    }
});


/**
 * GET /api/admin/financials
 * aggregations for financial dashboard
 */
router.get('/financials', async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;
        const { query } = require('../database/db');

        // Default to current month if not specified
        const start = startDate ? `${startDate} 00:00:00` : new Date(new Date().setDate(1)).toISOString().split('T')[0] + ' 00:00:00';
        const end = endDate ? `${endDate} 23:59:59` : new Date().toISOString().split('T')[0] + ' 23:59:59';
        // Parse drawId filter
        const drawParam = req.query.drawId;
        const drawId = drawParam ? parseInt(drawParam) : null;

        const params = [start, end];
        let filterClause = '';
        if (drawId) {
            filterClause = 'AND payment_orders.draw_id = $3'; // We need to join orders to filter by draw
            // For prizes it's easier: WHERE id = $3
        }

        console.log(`[Admin API] Financials request: ${start} to ${end} (Group: ${groupBy})`);

        // 1. REVENUE (Payments)
        // Group by Date
        let dateTrunc;
        if (groupBy === 'month') {
            dateTrunc = "TO_CHAR(p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')";
        } else if (groupBy === 'week') {
            dateTrunc = "TO_CHAR(p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'IYYY-IW')";
        } else if (groupBy === 'fortnight') {
            dateTrunc = "TO_CHAR(p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') || '-' || CASE WHEN EXTRACT(DAY FROM (p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')) <= 15 THEN '1' ELSE '2' END";
        } else {
            // Default Day
            dateTrunc = "DATE(p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::text";
        }

        // Build Revenue Query with Filter
        let revQuery = `
            SELECT 
                ${dateTrunc} as period,
                COUNT(*) as sales_count, 
                COUNT(DISTINCT p.txid) as real_transactions_count,
                COUNT(DISTINCT split_part(payment_orders.buyer_ref, '|', 2)) as unique_customers,
                COALESCE(SUM(p.amount_paid), 0) as total_revenue
            FROM payments p
            JOIN orders payment_orders ON p.order_id = payment_orders.order_id
            WHERE p.paid_at >= $1 AND p.paid_at <= $2
        `;

        if (drawId) {
            revQuery += ` AND payment_orders.draw_id = $3`;
            params.push(drawId);
        }

        revQuery += ` GROUP BY period ORDER BY period DESC`;

        const revRes = await query(revQuery, params);

        // 2. PRIZES (Closed Draws or Winners)
        // If drawId is specific, we only check that draw
        let prizeDateTrunc;
        if (groupBy === 'month') {
            prizeDateTrunc = "TO_CHAR(closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')";
        } else if (groupBy === 'week') {
            prizeDateTrunc = "TO_CHAR(closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'IYYY-IW')";
        } else if (groupBy === 'fortnight') {
            prizeDateTrunc = "TO_CHAR(closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') || '-' || CASE WHEN EXTRACT(DAY FROM (closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')) <= 15 THEN '1' ELSE '2' END";
        } else {
            prizeDateTrunc = "DATE(closed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::text";
        }

        let prizeQuery = `
            SELECT 
                ${prizeDateTrunc} as period,
                SUM(payout_each * winners_count) as total_prizes,
                COUNT(*) as draws_count
            FROM draws
            WHERE (status = 'CLOSED' OR winners_count > 0)
              AND closed_at >= $1 AND closed_at <= $2
        `;

        const prizeParams = [start, end];
        if (drawId) {
            prizeQuery += ` AND id = $3`;
            prizeParams.push(drawId);
        }

        prizeQuery += ` GROUP BY period ORDER BY period DESC`;

        const prizeRes = await query(prizeQuery, prizeParams);

        // EXTRA: If filtering by Draw, get separate stats per day if needed
        // The user asked for "Quantities of sales per day, Unique Customers per day"
        // We can add this to the main return object if filtering by draw.

        // 3. Merge Data
        const periods = new Set([...revRes.rows.map(r => r.period), ...prizeRes.rows.map(r => r.period)]);
        const history = [];
        let totalRevenue = 0;
        let totalPrizes = 0;
        let totalFees = 0;

        for (const p of periods) {
            const rev = revRes.rows.find(r => r.period === p) || { total_revenue: 0, sales_count: 0, real_transactions_count: 0 };
            const prz = prizeRes.rows.find(r => r.period === p) || { total_prizes: 0 };

            const revenue = parseFloat(rev.total_revenue);
            const prizes = parseFloat(prz.total_prizes);
            const sales = parseInt(rev.sales_count);
            const transactions = parseInt(rev.real_transactions_count || 0);
            const unique = parseInt(rev.unique_customers || 0);

            // Fee 0.99%
            const fees = revenue * 0.0099;

            totalRevenue += revenue;
            totalPrizes += prizes;
            totalFees += fees;

            history.push({
                date: p,
                revenue,
                sales,        // Tickets/Cotas
                transactions, // MP Tx
                unique,       // Unique Customers count
                prizes,
                fees,
                profit: revenue - prizes - fees
            });
        }

        // Sort history by date descending
        history.sort((a, b) => b.date.localeCompare(a.date));

        const netProfit = totalRevenue - totalPrizes - totalFees;

        res.json({
            summary: {
                totalRevenue,
                totalPrizes,
                totalFees,
                netProfit
            },
            history
        });

    } catch (error) {
        console.error('[Admin API] Financials Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/all-draws
 * Get list of all draws for filters
 */
router.get('/all-draws', async (req, res) => {
    try {
        const { query } = require('../database/db');
        const result = await query(`
            SELECT id, draw_name, status, created_at 
            FROM draws 
            ORDER BY id DESC
        `);
        res.json({ draws: result.rows });
    } catch (error) {
        console.error('[Admin API] Error getting all draws:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/fix-financials
 * Run historical fix for payment amounts
 */
router.get('/fix-financials', async (req, res) => {
    try {
        console.log('🔄 Starting Financial History Fix via API...');
        const { query } = require('../database/db');
        const result = await query(`
            SELECT raw_payload 
            FROM webhook_events 
            WHERE status IN ('PROCESSED', 'COMPLETED')
        `);

        let updatedCount = 0;
        for (const row of result.rows) {
            let payload = typeof row.raw_payload === 'string' ? JSON.parse(row.raw_payload) : row.raw_payload;
            const { order_id, amount_paid } = payload;
            if (!order_id || !amount_paid) continue;

            const orderIds = order_id.includes(',') ? order_id.split(',') : [order_id];
            const cleanOrderIds = orderIds.map(id => id.trim());
            const totalPaid = parseFloat(amount_paid);

            if (cleanOrderIds.length > 0 && !isNaN(totalPaid)) {
                const amountPerOrder = totalPaid / cleanOrderIds.length;
                for (const id of cleanOrderIds) {
                    const { query } = require('../database/db');
                    await query(`UPDATE payments SET amount_paid = $1 WHERE order_id = $2`, [amountPerOrder, id]);
                }
                updatedCount += cleanOrderIds.length;
            }
        }
        res.json({ success: true, updated: updatedCount, message: 'Fixed historical payments' });
    } catch (error) {
        console.error('Fix Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/purchase-distribution
 * Get distribution of purchases by quantity per customer
 */
router.get('/purchase-distribution', async (req, res) => {
    try {
        const { query } = require('../database/db');

        // Get current active draw
        const drawRes = await query(`SELECT id FROM draws WHERE status = 'ACTIVE' LIMIT 1`);
        if (drawRes.rows.length === 0) {
            return res.json({ distribution: [], totals: {} });
        }
        const drawId = drawRes.rows[0].id;

        // Get purchase count per unique customer (by phone)
        const result = await query(`
            WITH customer_purchases AS (
                SELECT 
                    SUBSTRING(buyer_ref FROM '[0-9]{10,11}') as phone,
                    COUNT(*) as ticket_count
                FROM orders 
                WHERE draw_id = $1 AND status = 'PAID'
                GROUP BY SUBSTRING(buyer_ref FROM '[0-9]{10,11}')
            ),
            distribution AS (
                SELECT 
                    CASE 
                        WHEN ticket_count = 1 THEN '1'
                        WHEN ticket_count BETWEEN 2 AND 5 THEN '2-5'
                        WHEN ticket_count BETWEEN 6 AND 10 THEN '6-10'
                        WHEN ticket_count BETWEEN 11 AND 20 THEN '11-20'
                        WHEN ticket_count BETWEEN 21 AND 50 THEN '21-50'
                        ELSE '51+'
                    END as range,
                    COUNT(*) as customer_count,
                    SUM(ticket_count) as total_tickets
                FROM customer_purchases
                GROUP BY 1
            )
            SELECT * FROM distribution
            ORDER BY 
                CASE range 
                    WHEN '1' THEN 1
                    WHEN '2-5' THEN 2
                    WHEN '6-10' THEN 3
                    WHEN '11-20' THEN 4
                    WHEN '21-50' THEN 5
                    ELSE 6
                END
        `, [drawId]);

        // Calculate totals
        const totalCustomers = result.rows.reduce((sum, r) => sum + parseInt(r.customer_count), 0);
        const totalTickets = result.rows.reduce((sum, r) => sum + parseInt(r.total_tickets), 0);

        res.json({
            distribution: result.rows,
            totals: {
                customers: totalCustomers,
                tickets: totalTickets
            },
            draw_id: drawId
        });

    } catch (error) {
        console.error('[Admin] Purchase distribution error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
