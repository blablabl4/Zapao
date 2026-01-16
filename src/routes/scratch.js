/**
 * Scratchcard API Routes
 */
const express = require('express');
const router = express.Router();
const ScratchCardService = require('../services/ScratchCardService');

/**
 * GET /api/scratch/pending
 * Get pending scratchcards for logged-in user
 */
router.get('/pending', async (req, res) => {
    try {
        if (!req.session?.userId) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        const cards = await ScratchCardService.getPendingByCustomer(req.session.userId);
        res.json({ cards, count: cards.length });
    } catch (e) {
        console.error('[Scratch API] Error fetching pending:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/scratch/pending-by-order/:orderId
 * Get pending scratchcards for a specific order (post-payment modal)
 */
router.get('/pending-by-order/:orderId', async (req, res) => {
    try {
        const cards = await ScratchCardService.getPendingByOrder(req.params.orderId);
        res.json({ cards, count: cards.length });
    } catch (e) {
        console.error('[Scratch API] Error fetching by order:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/scratch/status/:token
 * Get status of a specific scratchcard
 */
router.get('/status/:token', async (req, res) => {
    try {
        const card = await ScratchCardService.getByToken(req.params.token);
        if (!card) {
            return res.status(404).json({ error: 'Raspadinha não encontrada' });
        }

        res.json({
            token: card.token,
            status: card.status,
            isWinner: card.is_winner,
            prizeValue: card.prize_value,
            grid: card.generated_grid ? JSON.parse(card.generated_grid) : null,
            createdAt: card.created_at,
            revealedAt: card.revealed_at
        });
    } catch (e) {
        console.error('[Scratch API] Error fetching status:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/scratch/reveal/:token
 * Reveal a scratchcard (THE MOMENT OF TRUTH)
 */
router.post('/reveal/:token', async (req, res) => {
    try {
        const result = await ScratchCardService.reveal(req.params.token);
        res.json(result);
    } catch (e) {
        console.error('[Scratch API] Error revealing:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/scratch/claim/:token
 * Claim a winning scratchcard
 */
router.post('/claim/:token', async (req, res) => {
    try {
        const { pixKey } = req.body;
        const result = await ScratchCardService.claim(req.params.token, pixKey);
        res.json(result);
    } catch (e) {
        console.error('[Scratch API] Error claiming:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/scratch/admin/unclaimed
 * Admin: Get all unclaimed prizes
 */
router.get('/admin/unclaimed', async (req, res) => {
    try {
        // TODO: Add admin auth check
        const winners = await ScratchCardService.getUnclaimedWinners();
        res.json({ winners, count: winners.length });
    } catch (e) {
        console.error('[Scratch API] Error fetching unclaimed:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
