const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const DrawService = require('../services/DrawService');

/**
 * GET /api/audit/affiliates
 * Public endpoint for affiliate audit with unique clients
 * Optional: ?draw_id=X for specific draw
 * Default: Returns accumulated historical data from ALL draws
 */
router.get('/affiliates', async (req, res) => {
    try {
        const drawId = req.query.draw_id ? parseInt(req.query.draw_id) : null;

        let stats;
        let responseData = {};

        if (drawId) {
            // Specific draw mode
            const drawRes = await query('SELECT * FROM draws WHERE id = $1', [drawId]);
            if (drawRes.rows.length === 0) {
                return res.status(404).json({ error: 'Draw not found' });
            }
            const targetDraw = drawRes.rows[0];
            stats = await getAffiliateStatsWithUniqueClients(targetDraw.id);

            responseData = {
                mode: 'specific',
                draw_id: targetDraw.id,
                draw_name: targetDraw.draw_name,
                draw_status: targetDraw.status,
                total_affiliates: stats.length,
                affiliates: stats
            };
        } else {
            // Historical accumulated mode (ALL draws)
            stats = await getAffiliateStatsHistorical();

            responseData = {
                mode: 'historical',
                draw_id: null,
                total_affiliates: stats.length,
                affiliates: stats
            };
        }

        res.json(responseData);
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
 * Helper: Get total amount already paid to an affiliate
 */
async function getTotalPaid(phone) {
    try {
        const result = await query(
            `SELECT COALESCE(SUM(amount), 0) as total_paid 
             FROM affiliate_payments 
             WHERE affiliate_phone = $1`,
            [phone]
        );
        return parseFloat(result.rows[0]?.total_paid || 0);
    } catch (e) {
        console.error('[getTotalPaid] Error:', e.message);
        return 0;
    }
}

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

    // Enrich with affiliate names
    const enrichedResults = [];
    for (const row of result.rows) {
        let padrinhoName = '';
        let padrinhoPhone = '';

        try {
            // referrer_id is the phone number directly (NOT base64)
            // Extract digits only
            padrinhoPhone = (row.referrer_id || '').replace(/\D/g, '');

            // Validate phone - should be 10-11 digits
            if (padrinhoPhone && /^\d{10,11}$/.test(padrinhoPhone)) {
                // 1. Try affiliates table first
                const affRes = await query(`
                    SELECT name FROM affiliates 
                    WHERE phone = $1
                    LIMIT 1
                `, [padrinhoPhone]);

                if (affRes.rows.length > 0 && affRes.rows[0].name) {
                    padrinhoName = affRes.rows[0].name;
                }

                // 2. If not found, search orders where this phone is buyer
                if (!padrinhoName) {
                    const orderRes = await query(`
                        SELECT buyer_ref FROM orders 
                        WHERE buyer_ref LIKE $1
                        AND status = 'PAID'
                        ORDER BY created_at DESC
                        LIMIT 1
                    `, [`%${padrinhoPhone}%`]);

                    if (orderRes.rows.length > 0 && orderRes.rows[0].buyer_ref) {
                        const parts = orderRes.rows[0].buyer_ref.split('|');
                        if (parts[0] && parts[0].length > 1) {
                            padrinhoName = parts[0];
                        }
                    }
                }
            }

            // Fallback: show the phone if no name found
            if (!padrinhoName) {
                if (padrinhoPhone && padrinhoPhone.length >= 10) {
                    padrinhoName = `Afiliado ${padrinhoPhone.slice(-4)}`;
                } else {
                    padrinhoName = `Afiliado #${row.referrer_id.slice(0, 6)}`;
                }
            }

        } catch (e) {
            console.error(`[Audit] Error processing referrer: ${e.message}`);
            padrinhoName = `Afiliado #${(row.referrer_id || '').slice(0, 6)}`;
            padrinhoPhone = row.referrer_id || '';
        }

        // Calculate conversion: (transações / acessos) * 100 = percentual
        const transactions = parseInt(row.transaction_count) || 0;
        const accesses = parseInt(row.access_count) || 0;
        let conversionRate = '-';

        if (accesses > 0 && transactions > 0) {
            // Percentual de conversão
            const percentage = ((transactions / accesses) * 100).toFixed(1);
            conversionRate = `${percentage}%`;
        } else if (transactions > 0 && accesses === 0) {
            conversionRate = '100%'; // Venda direta
        }

        // Calculate commissions
        const totalRevenue = parseFloat(row.total_revenue || 0);
        const commissionRate = 0.50; // 50%
        const platformFee = 0.0099; // 0.99%
        const netCommissionRate = commissionRate - platformFee; // 49.01%
        const netCommission = totalRevenue * netCommissionRate;


        // Get sub-affiliates for this parent
        const subsResult = await query(`
            SELECT sub_code, sub_name, created_at FROM sub_affiliates WHERE parent_phone = $1
        `, [padrinhoPhone]);

        let subAffiliates = [];
        let allSubLinks = [];

        // Get all sub-links (even those without sales)
        for (const subRow of subsResult.rows) {
            allSubLinks.push({
                sub_name: subRow.sub_name,
                sub_code: subRow.sub_code,
                link: `https://www.tvzapao.com.br/zapao-da-sorte?ref=${subRow.sub_code}`,
                created_at: subRow.created_at
            });
        }

        const subCodes = subsResult.rows.map(s => s.sub_code);

        if (subCodes.length > 0) {
            // Get sales stats for each sub-affiliate
            const subStats = await query(`
                SELECT 
                    referrer_id,
                    COUNT(*) as ticket_count,
                    SUM(amount) as total_revenue,
                    COUNT(DISTINCT buyer_ref) as unique_clients
                FROM orders
                WHERE draw_id = $1
                  AND status = 'PAID'
                  AND referrer_id = ANY($2)
                GROUP BY referrer_id
            `, [drawId, subCodes]);

            // Build sub-affiliates with sales data
            for (const subRow of subStats.rows) {
                const subInfo = subsResult.rows.find(s => s.sub_code === subRow.referrer_id);

                const subRevenue = parseFloat(subRow.total_revenue || 0);
                // Calculate NET revenue after payment fee (0.99%)
                const netRevenue = subRevenue * (1 - 0.0099);
                // Sub and parent each get 25% of NET revenue
                const subCommission = netRevenue * 0.25;
                const parentCommission = netRevenue * 0.25;

                subAffiliates.push({
                    name: subInfo?.sub_name || subRow.referrer_id,
                    sub_code: subRow.referrer_id,
                    ticket_count: parseInt(subRow.ticket_count) || 0,
                    unique_clients: parseInt(subRow.unique_clients) || 0,
                    total_revenue: subRevenue,
                    sub_commission: subCommission,
                    parent_commission: parentCommission
                });
            }
        }

        // Calculate total parent commission from subs
        const parentCommissionFromSubs = subAffiliates.reduce((sum, sub) => sum + sub.parent_commission, 0);
        const totalCommission = netCommission + parentCommissionFromSubs;

        // Get payment info
        const paidAmount = await getTotalPaid(padrinhoPhone);
        const balance = totalCommission - paidAmount;
        const canWithdraw = balance >= 500;

        enrichedResults.push({
            referrer_id: row.referrer_id,
            name: padrinhoName,
            phone: formatPhone(padrinhoPhone),
            ticket_count: parseInt(row.ticket_count) || 0,
            unique_clients: parseInt(row.unique_clients) || 0,
            total_revenue: totalRevenue,
            net_commission: netCommission,
            parent_commission_from_subs: parentCommissionFromSubs,
            total_commission: totalCommission,
            paid_amount: paidAmount,
            balance: balance,
            can_withdraw: canWithdraw,
            access_count: accesses,
            conversion_rate: conversionRate,
            sub_affiliates: subAffiliates,
            all_sub_links: allSubLinks,
            sub_links_count: allSubLinks.length
        });
    }

    return enrichedResults;
}

/**
 * Get historical accumulated affiliate stats from ALL draws
 * Returns aggregated data with net commission calculations
 */
async function getAffiliateStatsHistorical() {
    // Get all affiliates with sales across all draws
    const result = await query(`
        WITH sales_stats AS (
            SELECT 
                referrer_id,
                COUNT(*) as ticket_count,
                COUNT(DISTINCT order_id) as transaction_count,
                SUM(amount) as total_revenue,
                COUNT(DISTINCT buyer_ref) as unique_clients,
                COUNT(DISTINCT draw_id) as draws_count
            FROM orders
            WHERE status = 'PAID'
              AND referrer_id IS NOT NULL
              AND referrer_id != ''
            GROUP BY referrer_id
        ),
        click_stats AS (
            SELECT 
                referrer_id,
                COUNT(*) as click_count
            FROM affiliate_clicks
            WHERE referrer_id IS NOT NULL
              AND referrer_id != ''
            GROUP BY referrer_id
        )
        SELECT
            COALESCE(s.referrer_id, c.referrer_id) as referrer_id,
            COALESCE(s.ticket_count, 0) as ticket_count,
            COALESCE(s.transaction_count, 0) as transaction_count,
            COALESCE(s.total_revenue, 0) as total_revenue,
            COALESCE(s.unique_clients, 0) as unique_clients,
            COALESCE(s.draws_count, 0) as draws_count,
            COALESCE(c.click_count, 0) as access_count
        FROM sales_stats s
        FULL OUTER JOIN click_stats c ON s.referrer_id = c.referrer_id
        WHERE s.ticket_count > 0
        ORDER BY s.total_revenue DESC NULLS LAST
    `);

    const enrichedResults = [];

    for (const row of result.rows) {
        let padrinhoName = null;
        let padrinhoPhone = '';

        try {
            // Extract phone from referrer_id
            padrinhoPhone = (row.referrer_id || '').replace(/\D/g, '');

            if (padrinhoPhone && /^\d{10,11}$/.test(padrinhoPhone)) {
                // Try affiliates table
                const affRes = await query(
                    `SELECT name FROM affiliates WHERE phone = $1 LIMIT 1`,
                    [padrinhoPhone]
                );

                if (affRes.rows.length > 0 && affRes.rows[0].name) {
                    padrinhoName = affRes.rows[0].name;
                }

                // Fallback: search in orders
                if (!padrinhoName) {
                    const orderRes = await query(
                        `SELECT buyer_ref FROM orders 
                         WHERE buyer_ref LIKE $1 AND status = 'PAID'
                         ORDER BY created_at DESC LIMIT 1`,
                        [`%${padrinhoPhone}%`]
                    );

                    if (orderRes.rows.length > 0 && orderRes.rows[0].buyer_ref) {
                        const parts = orderRes.rows[0].buyer_ref.split('|');
                        if (parts[0] && parts[0].length > 1) {
                            padrinhoName = parts[0];
                        }
                    }
                }
            }

            if (!padrinhoName) {
                padrinhoName = `Afiliado #${(row.referrer_id || '').slice(0, 6)}`;
            }
        } catch (e) {
            console.error(`[Audit] Error processing referrer: ${e.message}`);
            padrinhoName = `Afiliado #${(row.referrer_id || '').slice(0, 6)}`;
        }

        // Calculate conversion
        const transactions = parseInt(row.transaction_count) || 0;
        const accesses = parseInt(row.access_count) || 0;
        let conversionRate = '-';

        if (accesses > 0 && transactions > 0) {
            const percentage = ((transactions / accesses) * 100).toFixed(1);
            conversionRate = `${percentage}%`;
        } else if (transactions > 0 && accesses === 0) {
            conversionRate = '100%';
        }

        // Calculate NET commissions (49.01% for direct sales)
        const totalRevenue = parseFloat(row.total_revenue || 0);
        const netCommissionRate = 0.4901; // 50% - 0.99% fee
        const netCommission = totalRevenue * netCommissionRate;

        // Get sub-affiliates (accumulated across all draws)
        const subsResult = await query(
            `SELECT sub_code, sub_name, created_at FROM sub_affiliates WHERE parent_phone = $1`,
            [padrinhoPhone]
        );

        let subAffiliates = [];
        let allSubLinks = [];

        for (const subRow of subsResult.rows) {
            allSubLinks.push({
                sub_name: subRow.sub_name,
                sub_code: subRow.sub_code,
                link: `https://www.tvzapao.com.br/zapao-da-sorte?ref=${subRow.sub_code}`,
                created_at: subRow.created_at
            });
        }

        const subCodes = subsResult.rows.map(s => s.sub_code);
        let parentCommissionFromSubs = 0;

        if (subCodes.length > 0) {
            // Get accumulated sales stats for sub-affiliates
            const subStats = await query(
                `SELECT 
                    referrer_id,
                    COUNT(*) as ticket_count,
                    SUM(amount) as total_revenue,
                    COUNT(DISTINCT buyer_ref) as unique_clients
                 FROM orders
                 WHERE status = 'PAID' AND referrer_id = ANY($1)
                 GROUP BY referrer_id`,
                [subCodes]
            );

            for (const subRow of subStats.rows) {
                const subInfo = subsResult.rows.find(s => s.sub_code === subRow.referrer_id);
                const subRevenue = parseFloat(subRow.total_revenue || 0);
                // Calculate NET revenue after payment fee (0.99%)
                const netRevenue = subRevenue * (1 - 0.0099);
                // Sub and parent each get 25% of NET revenue
                const subCommission = netRevenue * 0.25;
                const parentCommission = netRevenue * 0.25;

                parentCommissionFromSubs += parentCommission;

                subAffiliates.push({
                    name: subInfo ? subInfo.sub_name : 'Sub-Afiliado',
                    sub_code: subRow.referrer_id,
                    unique_clients: parseInt(subRow.unique_clients) || 0,
                    sub_commission: subCommission,
                    parent_commission: parentCommission
                });
            }
        }

        const totalCommission = netCommission + parentCommissionFromSubs;

        // Get payment info
        const paidAmount = await getTotalPaid(padrinhoPhone);
        const balance = totalCommission - paidAmount;
        const canWithdraw = balance >= 500;

        enrichedResults.push({
            name: padrinhoName,
            phone: formatPhone(padrinhoPhone),
            ticket_count: parseInt(row.ticket_count) || 0,
            unique_clients: parseInt(row.unique_clients) || 0,
            draws_count: parseInt(row.draws_count) || 0,
            total_revenue: totalRevenue,
            net_commission: netCommission,
            parent_commission_from_subs: parentCommissionFromSubs,
            total_commission: totalCommission,
            paid_amount: paidAmount,
            balance: balance,
            can_withdraw: canWithdraw,
            access_count: accesses,
            conversion_rate: conversionRate,
            sub_affiliates: subAffiliates,
            all_sub_links: allSubLinks,
            sub_links_count: allSubLinks.length
        });
    }

    return enrichedResults;
}

// Format phone number - Brazilian format
function formatPhone(phone) {
    if (!phone) return '-';

    // Remove non-digits
    const digits = String(phone).replace(/\D/g, '');

    // Brazilian mobile: 11 digits = (XX) XXXXX-XXXX
    if (digits.length === 11) {
        const ddd = digits.slice(0, 2);
        const part1 = digits.slice(2, 7);
        const part2 = digits.slice(7, 11);
        return `(${ddd}) ${part1}-${part2}`;
    }

    // Brazilian landline: 10 digits = (XX) XXXX-XXXX
    if (digits.length === 10) {
        const ddd = digits.slice(0, 2);
        const part1 = digits.slice(2, 6);
        const part2 = digits.slice(6, 10);
        return `(${ddd}) ${part1}-${part2}`;
    }

    // Fallback: show as-is
    if (digits.length > 0) {
        return digits;
    }

    return '-';
}

/**
 * POST /api/audit/sub-affiliate
 * Create a sub-affiliate link for an existing affiliate
 */
router.post('/sub-affiliate', async (req, res) => {
    try {
        const { parent_phone, sub_name } = req.body;

        if (!parent_phone || !sub_name) {
            return res.status(400).json({ error: 'parent_phone e sub_name são obrigatórios' });
        }

        // Clean phone number
        const cleanPhone = parent_phone.replace(/\D/g, '');

        // Generate unique sub_code from name
        const baseCode = sub_name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 20);

        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const sub_code = `${baseCode}-${randomSuffix}`;

        // Insert sub-affiliate
        await query(`
            INSERT INTO sub_affiliates (parent_phone, sub_name, sub_code)
            VALUES ($1, $2, $3)
        `, [cleanPhone, sub_name, sub_code]);

        // Generate full link
        const link = `https://www.tvzapao.com.br/zapao-da-sorte?ref=${sub_code}`;

        res.json({
            success: true,
            sub_affiliate: {
                sub_name,
                sub_code,
                link,
                parent_phone: cleanPhone
            }
        });
    } catch (error) {
        console.error('[Audit API] Sub-affiliate creation error:', error.message);
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Código de sub-afiliado já existe. Tente outro nome.' });
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/audit/sub-affiliates
 * List sub-affiliates for a parent affiliate with their stats
 */
router.get('/sub-affiliates', async (req, res) => {
    try {
        const { parent_phone, draw_id } = req.query;

        if (!parent_phone) {
            return res.status(400).json({ error: 'parent_phone é obrigatório' });
        }

        const cleanPhone = parent_phone.replace(/\D/g, '');

        // Get all sub-affiliates for this parent
        const subsResult = await query(`
            SELECT id, sub_name, sub_code, created_at
            FROM sub_affiliates
            WHERE parent_phone = $1
            ORDER BY created_at DESC
        `, [cleanPhone]);

        // Get stats for each sub-affiliate
        const subsWithStats = await Promise.all(subsResult.rows.map(async (sub) => {
            // Count orders where referrer_id matches sub_code
            const statsQuery = draw_id
                ? `SELECT COUNT(*) as ticket_count, COALESCE(SUM(amount), 0) as revenue
                   FROM orders WHERE referrer_id = $1 AND draw_id = $2 AND status = 'PAID'`
                : `SELECT COUNT(*) as ticket_count, COALESCE(SUM(amount), 0) as revenue
                   FROM orders WHERE referrer_id = $1 AND status = 'PAID'`;

            const statsParams = draw_id ? [sub.sub_code, draw_id] : [sub.sub_code];
            const statsRes = await query(statsQuery, statsParams);

            return {
                ...sub,
                link: `https://www.tvzapao.com.br/zapao-da-sorte?ref=${sub.sub_code}`,
                ticket_count: parseInt(statsRes.rows[0]?.ticket_count || 0),
                revenue: parseFloat(statsRes.rows[0]?.revenue || 0)
            };
        }));

        res.json({
            parent_phone: cleanPhone,
            total_subs: subsWithStats.length,
            sub_affiliates: subsWithStats
        });
    } catch (error) {
        console.error('[Audit API] Sub-affiliates list error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/audit/payments
 * Register a payment to an affiliate
 * Minimum: R$ 500.00
 */
router.post('/payments', async (req, res) => {
    try {
        const { affiliate_phone, amount, payment_method, reference, notes, created_by } = req.body;

        // Validation
        if (!affiliate_phone || !amount) {
            return res.status(400).json({ error: 'Telefone e valor são obrigatórios' });
        }

        const paymentAmount = parseFloat(amount);

        // Minimum withdrawal check
        if (paymentAmount < 500) {
            return res.status(400).json({
                error: 'Valor mínimo para saque: R$ 500,00'
            });
        }

        // Get affiliate total commission
        const affiliateStats = await getAffiliateStatsHistorical();
        const affiliate = affiliateStats.find(a => a.phone.replace(/\D/g, '') === affiliate_phone.replace(/\D/g, ''));

        if (!affiliate) {
            return res.status(404).json({ error: 'Afiliado não encontrado' });
        }

        // Get total already paid
        const paidResult = await query(
            `SELECT COALESCE(SUM(amount), 0) as total_paid 
             FROM affiliate_payments 
             WHERE affiliate_phone = $1`,
            [affiliate_phone]
        );

        const totalPaid = parseFloat(paidResult.rows[0].total_paid || 0);
        const balance = affiliate.total_commission - totalPaid;

        // Balance check
        if (paymentAmount > balance) {
            return res.status(400).json({
                error: `Saldo insuficiente. Disponível: R$ ${balance.toFixed(2)}`
            });
        }

        // Register payment
        const insertResult = await query(
            `INSERT INTO affiliate_payments 
             (affiliate_phone, amount, payment_method, reference, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [affiliate_phone, paymentAmount, payment_method || 'PIX', reference, notes, created_by || 'Admin']
        );

        const newBalance = balance - paymentAmount;

        res.json({
            success: true,
            payment: insertResult.rows[0],
            new_balance: newBalance,
            can_withdraw: newBalance >= 500
        });

    } catch (error) {
        console.error('[Audit API] Payment error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/audit/payments/:phone
 * Get payment history for an affiliate
 */
router.get('/payments/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;

        const payments = await query(
            `SELECT * FROM affiliate_payments 
             WHERE affiliate_phone = $1 
             ORDER BY payment_date DESC`,
            [phone]
        );

        const totalPaid = payments.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        res.json({
            phone,
            payments: payments.rows,
            total_paid: totalPaid,
            payment_count: payments.rows.length
        });

    } catch (error) {
        console.error('[Audit API] Get payments error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
