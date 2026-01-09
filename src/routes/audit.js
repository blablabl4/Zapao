const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const DrawService = require('../services/DrawService');

/**
 * GET /api/audit/affiliates
 * Public endpoint for affiliate audit with unique clients
 * Optional: ?draw_id=X for specific draw, otherwise uses current
 */
router.get('/affiliates', async (req, res) => {
    try {
        const drawId = req.query.draw_id ? parseInt(req.query.draw_id) : null;

        let targetDraw;
        if (drawId) {
            const drawRes = await query('SELECT * FROM draws WHERE id = $1', [drawId]);
            if (drawRes.rows.length === 0) {
                return res.status(404).json({ error: 'Draw not found' });
            }
            targetDraw = drawRes.rows[0];
        } else {
            targetDraw = await DrawService.getCurrentDraw();
        }

        // Get affiliate stats with unique clients count
        const stats = await getAffiliateStatsWithUniqueClients(targetDraw.id);

        res.json({
            draw_id: targetDraw.id,
            draw_name: targetDraw.draw_name,
            draw_status: targetDraw.status,
            total_affiliates: stats.length,
            affiliates: stats
        });
    } catch (error) {
        console.error('[Audit API] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/audit/history
 * Get list of all draws for historical audit
 */
router.get('/history', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                d.id,
                d.draw_name,
                d.status,
                d.created_at,
                d.closed_at,
                d.drawn_number,
                d.winners_count,
                d.payout_each,
                (SELECT COUNT(DISTINCT referrer_id) FROM orders WHERE draw_id = d.id AND status = 'PAID' AND referrer_id IS NOT NULL) as affiliate_count,
                (SELECT COUNT(*) FROM orders WHERE draw_id = d.id AND status = 'PAID') as total_sales,
                (SELECT SUM(amount) FROM orders WHERE draw_id = d.id AND status = 'PAID') as total_revenue
            FROM draws d
            ORDER BY d.id DESC
            LIMIT 50
        `);

        res.json({
            total_draws: result.rows.length,
            draws: result.rows.map(row => ({
                id: row.id,
                name: row.draw_name,
                status: row.status,
                created_at: row.created_at,
                closed_at: row.closed_at,
                drawn_number: row.drawn_number,
                winners_count: row.winners_count,
                payout_each: parseFloat(row.payout_each || 0),
                affiliate_count: parseInt(row.affiliate_count || 0),
                total_sales: parseInt(row.total_sales || 0),
                total_revenue: parseFloat(row.total_revenue || 0)
            }))
        });
    } catch (error) {
        console.error('[Audit API] History error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get affiliate stats with unique clients count
 */
async function getAffiliateStatsWithUniqueClients(drawId) {
    // Get base affiliate stats
    const result = await query(`
        WITH sales_stats AS (
            SELECT 
                referrer_id, 
                COUNT(*) as ticket_count, 
                COUNT(DISTINCT order_id) as transaction_count,
                SUM(amount) as total_revenue,
                COUNT(DISTINCT buyer_ref) as unique_clients
            FROM orders 
            WHERE draw_id = $1 
              AND status = 'PAID' 
              AND referrer_id IS NOT NULL 
              AND referrer_id != ''
            GROUP BY referrer_id
        ),
        click_stats AS (
            SELECT referrer_id, COUNT(*) as click_count
            FROM affiliate_clicks
            WHERE draw_id = $1
              AND referrer_id IS NOT NULL
              AND referrer_id != ''
            GROUP BY referrer_id
        )
        SELECT 
            COALESCE(s.referrer_id, c.referrer_id) as referrer_id,
            COALESCE(s.ticket_count, 0) as ticket_count,
            COALESCE(s.transaction_count, 0) as transaction_count,
            COALESCE(s.total_revenue, 0) as total_revenue,
            COALESCE(s.unique_clients, 0) as unique_clients,
            COALESCE(c.click_count, 0) as access_count
        FROM sales_stats s
        FULL OUTER JOIN click_stats c ON s.referrer_id = c.referrer_id
        ORDER BY ticket_count DESC, total_revenue DESC
    `, [drawId]);

    // Enrich with affiliate names - IMPROVED lookup
    const enrichedResults = [];
    for (const row of result.rows) {
        let padrinhoName = '';
        let padrinhoPhone = '';

        try {
            // Decode referrer_id (base64 of PHONE-DRAWID)
            const decoded = Buffer.from(row.referrer_id, 'base64').toString('utf-8');
            console.log(`[Audit] Decoded referrer_id: ${decoded}`);

            if (decoded.includes('-')) {
                padrinhoPhone = decoded.split('-')[0];
                console.log(`[Audit] Extracted phone: ${padrinhoPhone}`);

                // 1. Try affiliates table first
                const affRes = await query(`
                    SELECT name FROM affiliates 
                    WHERE phone = $1 OR phone LIKE $2
                    LIMIT 1
                `, [padrinhoPhone, `%${padrinhoPhone.slice(-8)}%`]);

                if (affRes.rows.length > 0 && affRes.rows[0].name) {
                    padrinhoName = affRes.rows[0].name;
                    console.log(`[Audit] Found in affiliates: ${padrinhoName}`);
                }

                // 2. If not found, search ALL orders where this phone is buyer
                if (!padrinhoName) {
                    const orderRes = await query(`
                        SELECT buyer_ref FROM orders 
                        WHERE (buyer_ref LIKE $1 OR buyer_ref LIKE $2)
                        AND status = 'PAID'
                        ORDER BY created_at DESC
                        LIMIT 1
                    `, [`%|${padrinhoPhone}|%`, `%${padrinhoPhone.slice(-8)}%`]);

                    if (orderRes.rows.length > 0 && orderRes.rows[0].buyer_ref) {
                        const parts = orderRes.rows[0].buyer_ref.split('|');
                        padrinhoName = parts[0] || '';
                        console.log(`[Audit] Found in orders: ${padrinhoName}`);
                    }
                }

                // 3. Last resort: format phone nicely
                if (!padrinhoName && padrinhoPhone) {
                    padrinhoName = `Afiliado ${padrinhoPhone.slice(-4)}`;
                }
            } else {
                // referrer_id is not base64 encoded, use directly
                padrinhoPhone = decoded || row.referrer_id;
                padrinhoName = `Afiliado ${padrinhoPhone.slice(-4)}`;
            }
        } catch (e) {
            console.error(`[Audit] Error decoding: ${e.message}`);
            // Fallback: use referrer_id directly
            padrinhoPhone = row.referrer_id ? row.referrer_id.substring(0, 11) : '';
            padrinhoName = `Afiliado ${padrinhoPhone.slice(-4) || '???'}`;
        }

        // Calculate conversion: acessos / transações (cada compra completa)
        // Shows how many accesses per transaction (order)
        const tickets = parseInt(row.ticket_count) || 0;
        const transactions = parseInt(row.transaction_count) || 0;
        const accesses = parseInt(row.access_count) || 0;
        let conversionRate = '-';

        if (transactions > 0 && accesses > 0) {
            // Acessos por transação
            const accessesPerTransaction = (accesses / transactions).toFixed(1);
            conversionRate = `${accessesPerTransaction}:1`;
        } else if (transactions > 0 && accesses === 0) {
            conversionRate = 'Direto';
        }

        enrichedResults.push({
            referrer_id: row.referrer_id,
            name: padrinhoName || 'Sem nome',
            phone: padrinhoPhone ? formatPhone(padrinhoPhone) : '-',
            ticket_count: tickets,
            unique_clients: parseInt(row.unique_clients) || 0,
            total_revenue: parseFloat(row.total_revenue || 0),
            access_count: accesses,
            conversion_rate: conversionRate
        });
    }

    return enrichedResults;
}

// Format phone number
function formatPhone(phone) {
    if (!phone || phone.length < 10) return phone || '-';
    // Remove non-digits
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
}

module.exports = router;
