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
        if (isNaN(numValue) || numValue < 0 || numValue > 99) {
            return res.status(400).json({ error: 'drawn_number must be between 0 and 99' });
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
 * POST /api/admin/start-draw
 * Start a new draw (1-hour window)
 */
router.post('/start-draw', async (req, res) => {
    try {
        const { draw_name, prize_base } = req.body;

        if (!draw_name) {
            return res.status(400).json({ error: 'draw_name is required' });
        }

        const prizeValue = parseFloat(prize_base || process.env.PRIZE_BASE_AMOUNT || '500.00');
        const startTime = new Date();

        const draw = await DrawService.startDraw(draw_name, prizeValue, startTime);

        res.json({
            success: true,
            draw: {
                id: draw.id,
                draw_name: draw.draw_name,
                prize_base: parseFloat(draw.prize_base),
                current_prize: draw.current_prize,
                start_time: draw.start_time,
                end_time: draw.end_time,
                duration_minutes: draw.duration_minutes
            }
        });

    } catch (error) {
        console.error('[Admin API] Error starting draw:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
