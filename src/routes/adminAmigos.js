const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { query } = require('../database/db');
const AmigosAdminService = require('../services/AmigosAdminService');
const AmigosService = require('../services/AmigosService');

// All routes here should be protected by requireAdmin in server.js

router.get('/campaign', async (req, res) => {
    try {
        const campaign = await AmigosService.getActiveCampaign();
        res.json(campaign || {}); // Return empty obj if null to avoid client error
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

        if (numbersToAdd.length === 0) {
            return res.status(400).json({ error: 'Nenhum número válido fornecido.' });
        }

        // Bulk insert (using ON CONFLICT DO NOTHING)
        // We can use a loop or construct a big query. Loop is safer for small batches, but slow for huge ones.
        // Let's use a single query with VALUES.

        const client = await require('../database/db').getClient();
        try {
            await client.query('BEGIN');

            // Remove duplicates within the input itself
            const uniqueNumbers = [...new Set(numbersToAdd)];

            // Chunk it if needed (e.g. 1000 at a time), but let's assume reasonable input size for now (e.g. < 5000)
            const values = uniqueNumbers.map(n => `('${n}')`).join(',');

            const queryStr = `
                INSERT INTO az_whitelist (phone) 
                VALUES ${values}
                ON CONFLICT (phone) DO NOTHING
            `;

            const result = await client.query(queryStr);
            await client.query('COMMIT');

            res.json({
                success: true,
                message: `${result.rowCount} números adicionados com sucesso!`,
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
