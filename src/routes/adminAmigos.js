const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { query } = require('../database/db');
const AmigosAdminService = require('../services/AmigosAdminService');
const AmigosService = require('../services/AmigosService');

// All routes here should be protected by requireAdmin// GET Current Campaign (Active OR Latest)
router.get('/campaign', async (req, res) => {
    try {
        // First try to get active
        let campaign = await AmigosService.getActiveCampaign();
        
        // If no active, get the latest one (Draft mode support)
        if (!campaign) {
            const result = await query('SELECT * FROM az_campaigns ORDER BY created_at DESC LIMIT 1');
            if (result.rows.length > 0) {
                campaign = result.rows[0];
            }
        }

        res.json(campaign || {});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Diagnostic endpoint
router.get('/debug', async (req, res) => {
    try {
        const { query } = require('../database/db');

        // Get all campaigns
        const campaigns = await query('SELECT id, name, is_active, start_number, end_number FROM az_campaigns ORDER BY id');

        // Get active campaign
        const active = await AmigosService.getActiveCampaign();

        // Count available tickets per campaign
        const ticketCounts = await query(`
            SELECT campaign_id, status, COUNT(*) as count 
            FROM az_tickets 
            GROUP BY campaign_id, status
        `);

        // Total tickets
        const totalTickets = await query('SELECT COUNT(*) as total FROM az_tickets');

        res.json({
            campaigns: campaigns.rows,
            active_campaign: active,
            ticket_counts: ticketCounts.rows,
            total_tickets: totalTickets.rows[0].total
        });
    } catch (e) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

router.post('/campaign', async (req, res) => {
    try {
        const { name, start_number, end_number, config } = req.body;
        let campaign = await AmigosService.getActiveCampaign();

        // 1. Create or Update Campaign
        if (campaign) {
            campaign = await AmigosAdminService.updateCampaign(campaign.id, {
                name, start_number, end_number, base_qty_config: config,
                is_active: req.body.is_active
            });
        } else {
            campaign = await AmigosAdminService.createCampaign({
                name, start_number, end_number, base_qty_config: config,
                is_active: req.body.is_active
            });
        }

        // 2. Auto-Generate Tickets (Sync)
        console.log('[AdminAmigos] Auto-generating tickets for campaign:', campaign.id);
        const ticketResult = await AmigosService.populateTickets(campaign.id);
        console.log('[AdminAmigos] Tickets synced:', ticketResult);

        res.json({
            ...campaign,
            ticket_sync: ticketResult
        });

    } catch (e) {
        console.error('Save campaign error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/campaign/house-winner', async (req, res) => {
    try {
        const { campaignId, active } = req.body;
        const result = await AmigosService.toggleHouseWinner(campaignId, active);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/campaign/tickets', async (req, res) => {
    try {
        const { campaignId } = req.body;
        console.log('[AdminAmigos] Initializing tickets for campaign:', campaignId);

        let result;
        let campaign;

        if (!campaignId) {
            // If no campaignId provided, get active campaign
            campaign = await AmigosService.getActiveCampaign();
            if (!campaign) {
                return res.status(400).json({ error: 'Nenhuma campanha ativa encontrada' });
            }
            console.log('[AdminAmigos] Using active campaign:', campaign.id, campaign.name);
            result = await AmigosService.populateTickets(campaign.id);
        } else {
            result = await AmigosService.populateTickets(campaignId);
        }

        console.log('[AdminAmigos] populateTickets result:', result);
        res.json({
            success: true,
            message: `✅ Sincronização Concluída!\nCriados: ${result.inserted}\nRemovidos (Fora do range): ${result.deleted}\nTotal Atual: ${result.total}`,
            details: result
        });
    } catch (e) {
        console.error('[AdminAmigos] Error initializing tickets:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/campaign/finish', async (req, res) => {
    try {
        const { campaignId } = req.body;
        console.log('[AdminAmigos] Finishing campaign:', campaignId);

        let targetId = campaignId;
        if (!targetId) {
            const campaign = await AmigosService.getActiveCampaign();
            if (!campaign) return res.status(400).json({ error: 'Nenhuma campanha ativa' });
            targetId = campaign.id;
        }

        const result = await AmigosService.finishCampaign(targetId);
        res.json({
            success: true,
            message: 'Campanha finalizada com sucesso! O sorteio foi encerrado.'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/campaign/reset', async (req, res) => {
    try {
        const { campaignId } = req.body;
        console.log('[AdminAmigos] Resetting tickets for campaign:', campaignId);

        let targetId = campaignId;
        if (!targetId) {
            const campaign = await AmigosService.getActiveCampaign();
            if (!campaign) return res.status(400).json({ error: 'Nenhuma campanha ativa' });
            targetId = campaign.id;
        }

        const result = await AmigosAdminService.resetTickets(targetId);
        res.json({
            success: true,
            message: `♻️ Distribuição zerada! ${result.claims_deleted} resgates removidos, ${result.tickets_reset} números liberados.`
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Finish Campaign (Mark inactive)
router.post('/campaign/finish', async (req, res) => {
    try {
        const { campaignId } = req.body;
        // Invalidate cache first
        const AmigosService = require('../services/AmigosService'); // Ensure service is available if not global
        // Wait, AmigosService is required at top.

        // We need a method to cleanup/disable.
        // Assuming updateCampaign can set is_active = false
        if (!campaignId) return res.status(400).json({ error: 'No campaign ID' });

        await AmigosAdminService.updateCampaign(campaignId, { is_active: false });
        // Maybe explicitly clear house winner?
        // Let's toggle it off too just to be safe for history logic?
        // Actually, updateCampaign updates what is passed.
        // Let's add manual cache invalidation just in case.
        // AmigosService is instance? No, it's exported instance or class?
        // Top of file: const AmigosService = require('../services/AmigosService');
        // Check service definition. It exported 'new AmigosService()' presumably or class.
        // File 794 shows `class AmigosService`.
        // The require in adminAmigos.js line 6: `const AmigosService = require('../services/AmigosService');`
        // If it exports class index, we need to see how it's used.
        // Line 12: `const campaign = await AmigosService.getActiveCampaign();` -> implying it exports an INSTANCE or static methods.
        // File 794 shows `class AmigosService { ... }`.
        // Usually `module.exports = new AmigosService();`
        // If so, `AmigosService.invalidateCache()` works.

        if (typeof AmigosService.invalidateCache === 'function') {
            AmigosService.invalidateCache();
        }

        res.json({ success: true });
    } catch (e) {
        console.error('Finish error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Restart Campaign (Complete Delete + Recreate)
router.post('/campaign/restart', async (req, res) => {
    try {
        const { password } = req.body;

        // Validate password using the existing admin session
        if (!req.session || !req.session.adminId) {
            return res.status(401).json({ error: 'Sessão inválida' });
        }

        // Verify the password matches

        const adminRes = await query('SELECT password_hash FROM admin_users WHERE id = $1', [req.session.adminId]);
        if (!adminRes.rows[0]) {
            return res.status(401).json({ error: 'Admin não encontrado' });
        }

        const isValid = await bcrypt.compare(password, adminRes.rows[0].password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Senha incorreta' });
        }

        // Get active campaign
        const campaign = await AmigosService.getActiveCampaign();
        if (!campaign) {
            return res.status(400).json({ error: 'Nenhuma campanha ativa para reiniciar' });
        }

        // Delete everything related to the campaign
        await AmigosAdminService.deleteCampaign(campaign.id);

        res.json({
            success: true,
            message: 'Campanha reiniciada com sucesso!'
        });
    } catch (e) {
        console.error('[AdminAmigos] Restart error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/promotions', async (req, res) => {
    try {
        const campaign = await AmigosService.getActiveCampaign();
        if (!campaign) return res.json([]);
        const promos = await AmigosAdminService.getPromotions(campaign.id);
        res.json(promos);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/promotions', async (req, res) => {
    try {
        const { name, extra_qty, starts_at, ends_at, image_url, share_text, sponsor_link } = req.body;
        const campaign = await AmigosService.getActiveCampaign();
        if (!campaign) throw new Error('No active campaign');

        const promo = await AmigosAdminService.createPromotion(campaign.id, {
            name, extra_qty, starts_at, ends_at, image_url, share_text, sponsor_link
        });
        res.json(promo);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/promotions/:id', async (req, res) => {
    try {
        const promo = await AmigosAdminService.updatePromotion(req.params.id, req.body);
        res.json(promo);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/promotions/:id', async (req, res) => {
    try {
        await AmigosAdminService.deletePromotion(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Image Upload Configuration
// Cloudinary configuration
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Store in memory for Cloudinary upload

// Configure Cloudinary from environment variables
const CLOUDINARY_CONFIGURED = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (CLOUDINARY_CONFIGURED) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('[Cloudinary] Configured successfully');
} else {
    console.warn('[Cloudinary] NOT configured - missing environment variables!');
    console.warn('  CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'MISSING');
    console.warn('  CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING');
    console.warn('  CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING');
}

router.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    // Check if Cloudinary is configured
    if (!CLOUDINARY_CONFIGURED) {
        return res.status(500).json({ error: 'Cloudinary não está configurado. Verifique as variáveis CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no Railway.' });
    }

    try {
        // Convert buffer to base64 data URI
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'tvzapao-promos',
            resource_type: 'auto' // Supports images and videos
        });

        res.json({ url: result.secure_url });
    } catch (e) {
        console.error('Cloudinary upload error:', e);
        res.status(500).json({ error: 'Failed to upload: ' + e.message });
    }
});

router.get('/search', async (req, res) => {
    try {
        const { term } = req.query;
        if (!term) return res.status(400).json({ error: 'Termo de busca obrigatório' });

        const result = await AmigosAdminService.searchParticipant(term);
        if (result) {
            res.json({ found: true, ...result });
        } else {
            res.json({ found: false });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/stats/promos/:id', async (req, res) => {
    try {
        const stats = await AmigosAdminService.getPromoStats(req.params.id);
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// === DRAW ROUTES ===
router.get('/draw/winner/:id', async (req, res) => {
    try {
        const winner = await AmigosAdminService.drawWinner(req.params.id);
        res.json(winner);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/draw/candidates/:id', async (req, res) => {
    try {
        const candidates = await AmigosAdminService.getDrawCandidates(req.params.id);
        res.json(candidates);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/stats/monitor/:id', async (req, res) => {
    try {
        const stats = await AmigosAdminService.getMonitorStats(req.params.id);
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/promotions/:id/token', async (req, res) => {
    try {
        const token = await AmigosAdminService.generatePromoToken(req.params.id);
        const host = req.headers.host;
        const link = `${req.protocol}://${host}/p/${token}`;
        res.json({ token, link });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/search', async (req, res) => {
    try {
        const { term } = req.query;
        if (!term) return res.status(400).json({ error: 'Term required' });

        const result = await AmigosAdminService.searchParticipant(term);
        res.json(result || { found: false });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const { period } = req.query; // '24h' or '7d'
        const stats = await AmigosAdminService.getStats(period || '24h');
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// === VIP ROUTES (Paid Version) ===
const AmigosVipService = require('../services/AmigosVipService');

router.get('/vip/stats', async (req, res) => {
    try {
        const campaign = await AmigosService.getActiveCampaign();
        if (!campaign) {
            return res.json({ total_purchases: 0, total_paid: 0, total_revenue: 0, available_numbers: 0 });
        }

        const result = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'PAID') as total_paid,
                COUNT(*) FILTER (WHERE status = 'PENDING') as total_pending,
                COUNT(*) as total_purchases,
                COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0) as total_revenue,
                COALESCE(SUM(qty) FILTER (WHERE status = 'PAID'), 0) as total_numbers_sold
            FROM az_vip_purchases
            WHERE campaign_id = $1
        `, [campaign.id]);

        const available = await AmigosVipService.getAvailableCount(campaign.id);

        res.json({
            ...result.rows[0],
            available_numbers: available
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/vip/purchases', async (req, res) => {
    try {
        const { limit = 100, status } = req.query;

        let queryStr = `
            SELECT 
                p.id,
                p.phone,
                p.name,
                p.qty,
                p.amount,
                p.status,
                p.created_at,
                c.name as campaign_name,
                ARRAY_AGG(t.number ORDER BY t.number) FILTER (WHERE t.number IS NOT NULL) as numbers
            FROM az_vip_purchases p
            LEFT JOIN az_campaigns c ON p.campaign_id = c.id
            LEFT JOIN az_tickets t ON t.assigned_purchase_id = p.id
        `;

        const params = [];
        if (status) {
            queryStr += ` WHERE p.status = $1`;
            params.push(status);
        }

        queryStr += `
            GROUP BY p.id, p.phone, p.name, p.qty, p.amount, p.status, p.created_at, c.name
            ORDER BY p.created_at DESC
            LIMIT $${params.length + 1}
        `;
        params.push(limit);

        const result = await query(queryStr, params);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/whitelist', async (req, res) => {
    try {
        const { phones, text } = req.body;
        let numbersToAdd = [];

        if (Array.isArray(phones)) {
            numbersToAdd = phones;
        } else if (text) {
            // Split by newlines, commas, etc and clean
            numbersToAdd = text.split(/[\n,;]+/).map(s => s.trim().replace(/\D/g, '')).filter(s => s.length >= 10);
        }

        // Allow empty list (clears everyone)
        // If numbersToAdd is empty, we just clear everything.

        const client = await require('../database/db').getClient();
        try {
            await client.query('BEGIN');

            // 1. Prepare new list values
            const uniqueNumbers = [...new Set(numbersToAdd)];

            // 2. Identify & Revoke Invalid Claims (The "Prune" Step)
            // If the list is empty, ALL claims are invalid.
            // If not empty, find claims NOT IN the new list.

            let revokeQuery = '';
            let revokeParams = [];

            if (uniqueNumbers.length > 0) {
                // We can't pass thousands of params easily in NOT IN ($1, $2...) limit 65535 placeholders
                // Better approach: Create a temp table or use VALUES
                // Let's use a Common Table Expression (CTE) or ANY(array) logic if postgres

                // Since we are inside a transaction, let's Truncate whitelist first? 
                // NO, we need the new list to compare. 

                // Strategy: 
                // A. Truncate whitelist.
                // B. Insert new numbers.
                // C. Delete claims where phone NOT IN (SELECT phone FROM az_whitelist).

                // This is much cleaner and scalable!

                // A. Clear Whitelist
                await client.query('TRUNCATE TABLE az_whitelist');

                // B. Insert New Numbers
                const values = uniqueNumbers.map(n => `('${n}')`).join(',');
                await client.query(`INSERT INTO az_whitelist (phone) VALUES ${values}`);

                // C. Find Claims to Revoke (Phone not in whitelist anymore)
                const toRevokeRes = await client.query(`
                    SELECT id FROM az_claims 
                    WHERE phone NOT IN (SELECT phone FROM az_whitelist)
                 `);

                const revokeIds = toRevokeRes.rows.map(r => r.id);

                if (revokeIds.length > 0) {
                    console.log(`[Whitelist] Revoking ${revokeIds.length} claims not in new list...`);

                    // Reset Tickets
                    await client.query(`
                        UPDATE az_tickets 
                        SET status = 'AVAILABLE', assigned_claim_id = NULL 
                        WHERE assigned_claim_id = ANY($1::int[])
                     `, [revokeIds]);

                    // Delete Claims
                    await client.query(`
                        DELETE FROM az_claims WHERE id = ANY($1::int[])
                     `, [revokeIds]);
                }

            } else {
                // Empty list -> Revoke ALL
                console.log('[Whitelist] Empty list provided. Revoking ALL claims.');
                await client.query('TRUNCATE TABLE az_whitelist');

                // Reset All Tickets that are assigned
                await client.query(`
                    UPDATE az_tickets 
                    SET status = 'AVAILABLE', assigned_claim_id = NULL 
                    WHERE status = 'ASSIGNED'
                 `);

                // Delete All Claims
                await client.query('DELETE FROM az_claims');
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: `Lista Sincronizada! ${uniqueNumbers.length} ativos.`,
                total_processed: uniqueNumbers.length
            });

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (e) {
        console.error('Whitelist upload error:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
