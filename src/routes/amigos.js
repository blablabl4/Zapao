const express = require('express');
const router = express.Router();
console.log('✅ [Routes] Amigos Router Loaded');
const AmigosService = require('../services/AmigosService');
const AmigosAdminService = require('../services/AmigosAdminService');
const { asyncHandler, ApiResponse, ErrorTypes } = require('../middleware/errorHandler');
const { validate } = require('../validators');

/**
 * Extract request info for logging
 */
// Imports removed (duplicates)
const { getRequestInfo } = require('../utils/http');

/**
 * GET /api/amigos/settings
 * Public settings for frontend (share content, group link, etc.)
 */
router.get('/settings', async (req, res) => {
    try {
        const campaign = await AmigosService.getActiveCampaign();

        // Default settings
        const defaults = {
            share_image: '/images/amigos-logo-new.png',
            share_text: '', // User requested no default text, only link if empty
            group_link: 'https://chat.whatsapp.com/IXz69vK0NPF8uFKt07TCYn'
        };

        // If campaign has config with share settings, use those
        if (campaign && campaign.base_qty_config && campaign.base_qty_config.share_settings) {
            const settings = campaign.base_qty_config.share_settings;
            res.json({
                share_image: settings.image || null, // Allow no image if not set
                share_text: settings.text || defaults.share_text,
                group_link: campaign.group_link || settings.group_link || defaults.group_link
            });
        } else {
            // New logic: Use campaign group link if available
            if (campaign && campaign.group_link) {
                defaults.group_link = campaign.group_link;
            }
            res.json(defaults);
        }
    } catch (e) {
        console.error('[Amigos] Settings error:', e);
        res.json({
            share_image: '/images/amigos-logo-new.png',
            share_text: 'Participe do sorteio diário GRÁTIS!',
            group_link: 'https://chat.whatsapp.com/IXz69vK0NPF8uFKt07TCYn'
        });
    }
});

// Get promotion info by token (for promo image display)
router.get('/promo/:token', async (req, res) => {
    try {
        const promo = await AmigosService.getPromoByToken(req.params.token);
        if (!promo) {
            return res.status(404).json({ error: 'Promoção não encontrada' });
        }
        res.json({
            id: promo.id,
            name: promo.name,
            image_url: promo.image_url,
            extra_qty: promo.extra_qty,
            share_text: promo.share_text,
            sponsor_link: promo.sponsor_link
        });
    } catch (e) {
        console.error('[Amigos] Get promo error:', e);
        res.status(500).json({ error: 'Erro ao buscar promoção' });
    }
});

/**
 * GET /api/amigos/status
 * Check lock status for a phone number
 */
router.get('/status', validate('phoneQuery', 'query'), async (req, res) => {
    try {
        const { phone } = req.query;
        const status = await AmigosService.checkLockStatus(phone);
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/amigos/lookup
 * Lookup user's numbers by phone - ONLY for active campaign
 */
router.get('/lookup', validate('phoneQuery', 'query'), async (req, res) => {
    try {
        const { phone } = req.query;
        const { query } = require('../database/db');

        // Get active campaign first
        const campaign = await AmigosService.getActiveCampaign();
        if (!campaign) {
            return res.json({ found: false, message: 'Nenhuma campanha ativa no momento.' });
        }

        // Get claims for this phone IN THE ACTIVE CAMPAIGN ONLY
        const claimsRes = await query(`
            SELECT c.id, c.name, c.claimed_at, c.total_qty, c.next_unlock_at,
                   array_agg(t.number ORDER BY t.number) as numbers,
                   cam.name as campaign_name
            FROM az_claims c
            LEFT JOIN az_tickets t ON t.assigned_claim_id = c.id
            JOIN az_campaigns cam ON c.campaign_id = cam.id
            WHERE c.phone = $1 AND c.campaign_id = $2
            GROUP BY c.id, cam.name
            ORDER BY c.claimed_at DESC
        `, [phone, campaign.id]);

        if (claimsRes.rows.length === 0) {
            return res.json({ found: false, message: 'Nenhum número encontrado para este telefone.' });
        }

        // Flatten all numbers (filter out nulls)
        const allNumbers = claimsRes.rows.flatMap(c => c.numbers || []).filter(n => n !== null);
        const lastName = claimsRes.rows[0].name;
        const lastClaim = claimsRes.rows[0].claimed_at;
        const nextUnlock = claimsRes.rows[0].next_unlock_at;

        res.json({
            found: true,
            name: lastName,
            phone,
            total_numbers: allNumbers.length,
            numbers: allNumbers,
            last_claim: lastClaim,
            next_unlock_at: nextUnlock,
            claims_count: claimsRes.rows.length
        });
    } catch (e) {
        console.error('[Amigos] Lookup error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Validate startClaim schema
router.post('/start', validate('startClaim'), async (req, res) => {
    try {
        const { phone, promo_token, device_id } = req.body;

        const result = await AmigosService.startClaim(phone || null, promo_token);

        // Save to session
        req.session.amigos_claim = {
            id: result.claim_session_id,
            expires_at: result.expires_at,
            base_qty: result.base_qty,
            extra_qty: result.extra_qty,
            total_qty: result.total_qty
        };

        req.session.save(); // Ensure save

        // Log (Fire and forget, prevent crash)
        try {
            const info = getRequestInfo(req);
            AmigosAdminService.logEvent('CLAIM_START', {
                ...info,
                promo_id: result.promo?.id,
                token: promo_token,
                phone: phone,
                metadata: { session_id: result.claim_session_id }
            }).catch(err => console.error('[Amigos] Log Start Error:', err.message));
        } catch (logErr) {
            console.error('[Amigos] Log Start Sync Error:', logErr.message);
        }

        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: e.message });
    }
});

// Validate finishClaim schema
router.post('/finish', validate('finishClaim'), async (req, res) => {
    try {
        const { claim_session_id, phone, name, shared_status, promo_token, lgpd_consent, device_id, cep } = req.body;

        const sessionData = req.session.amigos_claim;

        // Validate Session
        if (!sessionData || sessionData.id !== claim_session_id) {
            return res.status(400).json({ error: 'Sessão inválida ou expirada. Recarregue a página.' });
        }

        if (new Date() > new Date(sessionData.expires_at)) {
            return res.status(400).json({ error: 'Tempo esgotado. Recomece o processo.' });
        }

        const info = getRequestInfo(req);

        const result = await AmigosService.finishClaim(
            sessionData,
            phone,
            name,
            lgpd_consent,
            promo_token,
            info.ip,
            info.ua,
            device_id || info.deviceId,
            cep
        );

        // Clear session logic? Maybe keep to prevent replay
        delete req.session.amigos_claim;

        // Log
        // Log (Fire and forget, prevent crash)
        try {
            AmigosAdminService.logEvent('CLAIM_FINISH', {
                ...info,
                phone: phone,
                metadata: {
                    numbers: result.numbers,
                    total_qty: result.total_qty
                }
            }).catch(err => console.error('[Amigos] Log Finish Error:', err.message));
        } catch (logErr) {
            console.error('[Amigos] Log Finish Sync Error:', logErr.message);
        }

        res.json(result);

    } catch (e) {
        console.error(e);
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
