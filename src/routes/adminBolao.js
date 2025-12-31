const express = require('express');
const router = express.Router();
const { query } = require('../database/db');

/**
 * GET /api/admin/bolao/sales
 * Returns list of all sales (claims) for Bolão
 */
router.get('/sales', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                c.id, 
                c.payment_id, 
                c.name, 
                c.phone, 
                c.cpf, 
                c.total_qty, 
                c.round_number, 
                c.status, 
                c.claimed_at, 
                CASE WHEN c.status = 'PAID' THEN c.total_qty * 20 ELSE 0 END as total_value,
                string_agg(t.number::text, ', ') as ticket_numbers
            FROM az_claims c
            LEFT JOIN az_tickets t ON c.id = t.assigned_claim_id
            WHERE c.type = 'BOLAO'
            GROUP BY c.id
            ORDER BY 
                CASE WHEN c.status = 'PAID' THEN 1 
                     WHEN c.status = 'PENDING' THEN 2 
                     ELSE 3 
                END,
                c.claimed_at DESC
        `);

        // Also get simple stats
        const statsRes = await query(`
        SELECT
        count(*) FILTER(WHERE status = 'PAID') as total_orders,
            sum(total_qty) FILTER(WHERE status = 'PAID') as total_tickets,
                sum(total_qty * 20) FILTER(WHERE status = 'PAID') as total_revenue
            FROM az_claims
            WHERE type = 'BOLAO'
            `);

        const stats = statsRes.rows[0];
        const gross = parseFloat(stats.total_revenue || 0);
        const fee = gross * 0.0099; // 0.99% fee
        const net = gross - fee;

        res.json({
            sales: result.rows,
            stats: {
                totalOrders: parseInt(stats.total_orders || 0),
                totalTickets: parseInt(stats.total_tickets || 0),
                grossRevenue: gross,
                netRevenue: net
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/admin/bolao/tickets
 * Returns flat list of tickets for Excel export
 */
router.get('/tickets', async (req, res) => {
    try {
        // Force Campaign ID 21 (Bolão do Zapão Mega da Virada)
        const campaignId = 21;

        const result = await query(`
        SELECT
        t.round_number as "Rodada",
            t.number as "Cota",
            c.name as "Nome",
            c.phone as "Telefone",
            c.status as "Status Pagamento",
            to_char(c.claimed_at, 'DD/MM/YYYY HH24:MI:SS') as "Data Compra"
            FROM az_tickets t
            LEFT JOIN az_claims c ON t.assigned_claim_id = c.id
            WHERE t.campaign_id = $1
            ORDER BY t.round_number ASC, t.number ASC
            `, [campaignId]);

        res.json(result.rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});


/**
 * POST /api/admin/bolao/force-rotation
 * Manual trigger for round rotation
 */
router.post('/force-rotation', async (req, res) => {
    try {
        const { query } = require('../database/db');
        const campaignRes = await query("SELECT id FROM az_campaigns WHERE slug = 'mega-da-virada-2025'");
        if (campaignRes.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

        const BolaoService = require('../services/BolaoService');
        await BolaoService.checkRotation(campaignRes.rows[0].id, true);

        res.json({ success: true, message: 'Rotation FORCED successfully. New round started.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

