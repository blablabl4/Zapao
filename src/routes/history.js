const express = require('express');
const router = express.Router();
const DrawService = require('../services/DrawService');

/**
 * GET /api/history
 * Get draw history (public)
 */
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const history = await DrawService.getDrawHistory(limit);

        res.json({
            draws: history.map(draw => ({
                id: draw.id,
                draw_name: draw.draw_name,
                start_time: draw.start_time,
                end_time: draw.end_time,
                closed_at: draw.closed_at,
                duration_minutes: draw.duration_minutes,
                prize_base: parseFloat(draw.prize_base),
                reserve_amount: parseFloat(draw.reserve_amount),
                total_prize: parseFloat(draw.prize_base) + parseFloat(draw.reserve_amount),
                drawn_number: draw.drawn_number,
                winners_count: draw.winners_count,
                payout_each: parseFloat(draw.payout_each)
            }))
        });

    } catch (error) {
        console.error('[API /history] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/history/hot-numbers
 * Get top 10 most drawn numbers (last 7 days or all time)
 */
router.get('/hot-numbers', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7; // Default: last 7 days
        const hotNumbers = await DrawService.getHotNumbers(days);

        res.json({
            period_days: days,
            hot_numbers: hotNumbers
        });

    } catch (error) {
        console.error('[API /history/hot-numbers] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
