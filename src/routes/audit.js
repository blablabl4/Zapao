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
            // NEW DEFAULT: Try to find the LATEST ACTIVE draw (check various statuses)
            const activeDrawRes = await query("SELECT * FROM draws WHERE status IN ('ACTIVE', 'OPEN', 'active', 'open') ORDER BY id DESC LIMIT 1");

            if (activeDrawRes.rows.length > 0) {
                // Found active draw, show its stats by default
                const targetDraw = activeDrawRes.rows[0];
                stats = await getAffiliateStatsWithUniqueClients(targetDraw.id);

                responseData = {
                    mode: 'current_active',
                    draw_id: targetDraw.id,
                    draw_name: targetDraw.draw_name,
                    draw_status: targetDraw.status,
                    total_affiliates: stats.length,
                    affiliates: stats
                };
            } else {
                // No active draw, fallback to historical accumulated mode
                stats = await getAffiliateStatsHistorical();

                responseData = {
                    mode: 'historical',
                    draw_id: null,
                    total_affiliates: stats.length,
                    affiliates: stats
                };
            }
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
        let isSubaffiliate = false;
        let parentPhone = null;

        try {
            // referrer_id is the phone number directly (NOT base64)
            // Extract digits only
            padrinhoPhone = (row.referrer_id || '').replace(/\D/g, '');

            // Check if this is a sub-affiliate code first
            const subCheck = await query(
                `SELECT parent_phone, sub_name FROM sub_affiliates WHERE sub_code = $1 LIMIT 1`,
                [row.referrer_id]
            );

            if (subCheck.rows.length > 0) {
                // This is a sub-affiliate
                isSubaffiliate = true;
                parentPhone = formatPhone(subCheck.rows[0].parent_phone);
                padrinhoName = subCheck.rows[0].sub_name || `Sub #${row.referrer_id.slice(0, 6)}`;
                padrinhoPhone = row.referrer_id; // Keep the sub_code as identifier
            } else if (padrinhoPhone && /^\d{10,11}$/.test(padrinhoPhone)) {
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

        // Calculate commissions - different rates for padrinhos vs subaffiliates
        const totalRevenue = parseFloat(row.total_revenue || 0);
        const platformFee = 0.0099; // 0.99%
        // Padrinhos get 50%, subaffiliates get 25%
        const commissionRate = isSubaffiliate ? 0.25 : 0.50;
        const netRevenue = totalRevenue * (1 - platformFee); // Revenue after MP fee
        const netCommission = netRevenue * commissionRate;


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
            is_subaffiliate: isSubaffiliate,
            parent_phone: parentPhone,
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
        let isSubaffiliate = false;
        let parentPhone = null;

        try {
            // Extract phone from referrer_id
            padrinhoPhone = (row.referrer_id || '').replace(/\D/g, '');

            // Check if this is a sub-affiliate code first
            const subCheck = await query(
                `SELECT parent_phone, sub_name FROM sub_affiliates WHERE sub_code = $1 LIMIT 1`,
                [row.referrer_id]
            );

            if (subCheck.rows.length > 0) {
                // This is a sub-affiliate
                isSubaffiliate = true;
                parentPhone = formatPhone(subCheck.rows[0].parent_phone);
                padrinhoName = subCheck.rows[0].sub_name || `Sub #${row.referrer_id.slice(0, 6)}`;
                padrinhoPhone = row.referrer_id; // Keep the sub_code as identifier
            } else if (padrinhoPhone && /^\d{10,11}$/.test(padrinhoPhone)) {
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

        // Calculate NET commissions - different rates for padrinhos vs subaffiliates
        const totalRevenue = parseFloat(row.total_revenue || 0);
        const platformFee = 0.0099; // 0.99%
        // Padrinhos get 50%, subaffiliates get 25%
        const commissionRate = isSubaffiliate ? 0.25 : 0.50;
        const netRevenue = totalRevenue * (1 - platformFee);
        const netCommission = netRevenue * commissionRate;

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
            is_subaffiliate: isSubaffiliate,
            parent_phone: parentPhone,
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
        const { parent_phone, sub_name, sub_phone, pix_key } = req.body;

        if (!parent_phone || !sub_name) {
            return res.status(400).json({ error: 'parent_phone e sub_name são obrigatórios' });
        }

        if (!sub_phone) {
            return res.status(400).json({ error: 'sub_phone é obrigatório' });
        }

        // Clean phone numbers
        const cleanParentPhone = parent_phone.replace(/\D/g, '');
        const cleanSubPhone = sub_phone.replace(/\D/g, '');

        // Check if this phone already has a sub-affiliate link
        const existingCheck = await query(`
            SELECT sub_code, sub_name FROM sub_affiliates 
            WHERE sub_phone = $1 OR sub_phone = $2
            LIMIT 1
        `, [cleanSubPhone, sub_phone]);

        if (existingCheck.rows.length > 0) {
            const existing = existingCheck.rows[0];
            return res.status(409).json({
                error: `Este telefone já possui um link de sub-afiliado: ${existing.sub_name}`,
                existing_code: existing.sub_code
            });
        }

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

        // Insert sub-affiliate with phone and pix
        await query(`
            INSERT INTO sub_affiliates (parent_phone, sub_name, sub_code, sub_phone, pix_key)
            VALUES ($1, $2, $3, $4, $5)
        `, [cleanParentPhone, sub_name, sub_code, cleanSubPhone, pix_key || null]);

        // Generate full link
        const link = `https://www.tvzapao.com.br/zapao-da-sorte?ref=${sub_code}`;

        res.json({
            success: true,
            sub_affiliate: {
                sub_name,
                sub_code,
                link,
                parent_phone: cleanParentPhone
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
 * GET /api/audit/verify-fix-sublink
 * Temporary route to verify and fix the specific sublink
 */
router.get('/verify-fix-sublink', async (req, res) => {
    try {
        const subCode = 'rei-dos-brinquedos-olck';
        const targetPhone = '11991025621';

        // Check if exists
        const check = await query('SELECT * FROM sub_affiliates WHERE sub_code = $1', [subCode]);

        let result = {
            found: false,
            before: null,
            after: null,
            action: 'none'
        };

        if (check.rows.length > 0) {
            result.found = true;
            result.before = check.rows[0];

            // Update
            await query('UPDATE sub_affiliates SET sub_phone = $1 WHERE sub_code = $2', [targetPhone, subCode]);

            // Verify after
            const verify = await query('SELECT * FROM sub_affiliates WHERE sub_code = $1', [subCode]);
            result.after = verify.rows[0];
            result.action = 'updated';
        } else {
            // Insert if missing (using dummy parent if needed or try to find one)
            // Assuming parent might be the target phone itself if they are self-referring or we don't know.
            // Let's just report not found for now, user can create it if missing.
            result.action = 'not_found_cannot_update';
        }

        res.json(result);
    } catch (error) {
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
 * GET /api/audit/subaffiliate-earnings
 * Get earnings for a specific sub-affiliate by their phone number
 * Query params: phone (required), draw_id (optional)
 */
router.get('/subaffiliate-earnings', async (req, res) => {
    try {
        const { phone, draw_id } = req.query;

        if (!phone) {
            return res.status(400).json({ error: 'Telefone é obrigatório' });
        }

        const cleanPhone = phone.replace(/\D/g, '');

        // Find sub-affiliate by phone
        const subResult = await query(
            `SELECT id, sub_name, sub_code, parent_phone, pix_key, created_at 
             FROM sub_affiliates 
             WHERE sub_phone = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [cleanPhone]
        );

        if (subResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Sub-afiliado não encontrado. Verifique se seu telefone foi cadastrado pelo seu padrinho.',
                is_subaffiliate: false
            });
        }

        const subAffiliate = subResult.rows[0];

        // Get earnings for current draw (if specified) or all draws
        const currentDrawQuery = draw_id
            ? `SELECT COALESCE(SUM(amount), 0) as revenue, COUNT(*) as ticket_count, COUNT(DISTINCT buyer_ref) as unique_clients
               FROM orders WHERE referrer_id = $1 AND draw_id = $2 AND status = 'PAID'`
            : `SELECT COALESCE(SUM(amount), 0) as revenue, COUNT(*) as ticket_count, COUNT(DISTINCT buyer_ref) as unique_clients
               FROM orders WHERE referrer_id = $1 AND status = 'PAID'`;

        const statsParams = draw_id ? [subAffiliate.sub_code, draw_id] : [subAffiliate.sub_code];
        const statsResult = await query(currentDrawQuery, statsParams);

        const statsRow = statsResult.rows[0] || {};
        const revenue = parseFloat(statsRow.revenue || 0);
        const ticketCount = parseInt(statsRow.ticket_count || 0);
        const uniqueClients = parseInt(statsRow.unique_clients || 0);

        // Calculate NET commission (25% after payment fee of 0.99%)
        const netCommissionRate = 0.25 * (1 - 0.0099); // ~24.75%
        const netCommission = revenue * netCommissionRate;

        // Get historical total (all draws)
        const historyResult = await query(
            `SELECT COALESCE(SUM(amount), 0) as total_revenue, COUNT(*) as total_tickets
             FROM orders WHERE referrer_id = $1 AND status = 'PAID'`,
            [subAffiliate.sub_code]
        );

        const historyRow = historyResult.rows[0] || {};
        const totalRevenue = parseFloat(historyRow.total_revenue || 0);
        const totalCommission = totalRevenue * netCommissionRate;

        res.json({
            success: true,
            is_subaffiliate: true,
            sub_affiliate: {
                name: subAffiliate.sub_name,
                sub_code: subAffiliate.sub_code,
                parent_phone: formatPhone(subAffiliate.parent_phone),
                pix_key: subAffiliate.pix_key,
                created_at: subAffiliate.created_at
            },
            current: {
                draw_id: draw_id || 'all',
                revenue: revenue,
                tickets: ticketCount,
                unique_clients: uniqueClients,
                net_commission: netCommission
            },
            historical: {
                total_revenue: totalRevenue,
                total_net_commission: totalCommission
            }
        });

    } catch (error) {
        console.error('[Audit API] Subaffiliate earnings error:', error.message);
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
        const { affiliate_phone, amount, payment_method, reference, notes, created_by, override_validation } = req.body;

        // Validation
        if (!affiliate_phone || !amount) {
            return res.status(400).json({ error: 'Telefone e valor são obrigatórios' });
        }

        const paymentAmount = parseFloat(amount);

        // Minimum withdrawal check (can be overridden for exceptional cases)
        if (!override_validation && paymentAmount < 500) {
            return res.status(400).json({
                error: 'Valor mínimo para saque: R$ 500,00',
                can_override: true
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

        // Balance check (add epsilon tolerance for floating point precision)
        // Also allow override if explicitly requested
        const EPSILON = 0.05; // 5 cents tolerance
        if (paymentAmount > balance + EPSILON) {
            if (!override_validation) {
                return res.status(400).json({
                    error: `Saldo insuficiente. Disponível: R$ ${balance.toFixed(2)}`,
                    can_override: true,
                    balance: balance
                });
            }
            // Log warning if overriding balance
            console.warn(`[Payment Override] Admin paying R$ ${paymentAmount} exceeding balance of R$ ${balance} for ${affiliate_phone}`);
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

/**
 * GET /api/audit/affiliate-balance
 * Get accumulated balance for an affiliate (total commissions - paid amounts)
 * Returns: total_earned, total_paid, available_balance, current_draw_commission
 */
router.get('/affiliate-balance', async (req, res) => {
    try {
        const phone = (req.query.phone || '').replace(/\D/g, '');

        if (!phone || phone.length < 10) {
            return res.status(400).json({ error: 'Telefone inválido' });
        }

        // 1. Check if affiliate exists
        const affiliateResult = await query(
            `SELECT id, name, phone, pix_key FROM affiliates WHERE phone = $1 OR phone = $2`,
            [phone, `+55${phone}`]
        );

        if (affiliateResult.rows.length === 0) {
            // Check if it's a sub-affiliate
            const subResult = await query(
                `SELECT sa.id, sa.sub_name as name, sa.sub_phone as phone, sa.pix_key, sa.parent_phone, a.name as parent_name
                 FROM sub_affiliates sa
                 LEFT JOIN affiliates a ON a.phone = sa.parent_phone OR a.phone = '+55' || sa.parent_phone
                 WHERE sa.sub_phone = $1 OR sa.sub_phone = $2`,
                [phone, `+55${phone}`]
            );

            if (subResult.rows.length === 0) {
                return res.status(404).json({ error: 'Afiliado não encontrado' });
            }

            // Sub-affiliate balance calculation
            const sub = subResult.rows[0];
            const subCode = await query(
                `SELECT sub_code FROM sub_affiliates WHERE sub_phone = $1 OR sub_phone = $2`,
                [phone, `+55${phone}`]
            );
            const referrerCode = subCode.rows[0]?.sub_code;

            // Get total commissions for sub-affiliate (5% of their sales)
            const subEarnings = await query(`
                SELECT 
                    COALESCE(SUM(o.amount * 0.05), 0) as total_earned,
                    COUNT(DISTINCT o.id) as total_tickets,
                    COUNT(DISTINCT o.buyer_phone) as total_clients
                FROM orders o
                WHERE o.referrer_id = $1 
                AND o.status = 'PAID'
            `, [referrerCode]);

            // Get paid amounts (if tracked separately for subs, otherwise 0)
            const subPaid = await query(
                `SELECT COALESCE(SUM(amount), 0) as total_paid 
                 FROM affiliate_payments 
                 WHERE affiliate_phone = $1 OR affiliate_phone = $2`,
                [phone, `+55${phone}`]
            );

            const totalEarned = parseFloat(subEarnings.rows[0]?.total_earned || 0);
            const totalPaid = parseFloat(subPaid.rows[0]?.total_paid || 0);

            return res.json({
                success: true,
                is_sub_affiliate: true,
                affiliate: {
                    name: sub.name,
                    phone: sub.phone,
                    parent_name: sub.parent_name
                },
                earnings: {
                    total_earned: totalEarned,
                    total_paid: totalPaid,
                    available_balance: totalEarned - totalPaid,
                    total_tickets: parseInt(subEarnings.rows[0]?.total_tickets || 0),
                    total_clients: parseInt(subEarnings.rows[0]?.total_clients || 0)
                }
            });
        }

        // Main affiliate balance calculation
        const affiliate = affiliateResult.rows[0];

        // 2. Get TOTAL accumulated commissions from ALL draws
        const earningsResult = await query(`
            SELECT 
                COALESCE(SUM(o.amount * 0.20), 0) as direct_commission,
                COUNT(DISTINCT o.id) as total_tickets,
                COUNT(DISTINCT o.buyer_phone) as total_clients
            FROM orders o
            WHERE o.referrer_id = $1 
            AND o.status = 'PAID'
        `, [affiliate.phone]);

        // 3. Get bonus from sub-affiliates (5% split)
        const bonusResult = await query(`
            SELECT COALESCE(SUM(o.amount * 0.05), 0) as sub_bonus
            FROM orders o
            JOIN sub_affiliates sa ON o.referrer_id = sa.sub_code
            WHERE sa.parent_phone = $1 OR sa.parent_phone = $2
            AND o.status = 'PAID'
        `, [affiliate.phone, phone]);

        // 4. Get total paid
        const totalPaid = await getTotalPaid(affiliate.phone);
        const totalPaidAlt = await getTotalPaid(phone);
        const finalPaid = Math.max(totalPaid, totalPaidAlt);

        const directCommission = parseFloat(earningsResult.rows[0]?.direct_commission || 0);
        const subBonus = parseFloat(bonusResult.rows[0]?.sub_bonus || 0);
        const totalEarned = directCommission + subBonus;
        const availableBalance = totalEarned - finalPaid;

        // 5. Get current draw info (if active)
        let currentDrawCommission = 0;
        let currentDrawName = null;
        try {
            const currentDraw = await DrawService.getCurrentDraw();
            if (currentDraw) {
                currentDrawName = currentDraw.draw_name;
                const currentEarnings = await query(`
                    SELECT COALESCE(SUM(o.amount * 0.20), 0) as current_commission
                    FROM orders o
                    WHERE o.referrer_id = $1 
                    AND o.status = 'PAID'
                    AND o.draw_id = $2
                `, [affiliate.phone, currentDraw.id]);
                currentDrawCommission = parseFloat(currentEarnings.rows[0]?.current_commission || 0);
            }
        } catch (e) {
            console.log('[affiliate-balance] No current draw or error:', e.message);
        }

        res.json({
            success: true,
            is_sub_affiliate: false,
            affiliate: {
                name: affiliate.name,
                phone: affiliate.phone,
                pix_key: affiliate.pix_key
            },
            earnings: {
                total_earned: totalEarned,
                direct_commission: directCommission,
                sub_bonus: subBonus,
                total_paid: finalPaid,
                available_balance: availableBalance,
                total_tickets: parseInt(earningsResult.rows[0]?.total_tickets || 0),
                total_clients: parseInt(earningsResult.rows[0]?.total_clients || 0)
            },
            current_draw: currentDrawName ? {
                name: currentDrawName,
                commission: currentDrawCommission
            } : null
        });

    } catch (error) {
        console.error('[Audit API] Affiliate balance error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
