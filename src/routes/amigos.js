const express = require('express');
const router = express.Router();
const AmigosService = require('../services/AmigosService');
const AmigosAdminService = require('../services/AmigosAdminService');

const getRequestInfo = (req) => ({
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    ua: req.headers['user-agent'],
    deviceId: req.headers['x-device-id'] || req.body.device_id
});

router.get('/status', async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json({ error: 'Telefone obrigatório' });

        const status = await AmigosService.checkLockStatus(phone);
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/start', async (req, res) => {
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

        // Log
        const info = getRequestInfo(req);
        AmigosAdminService.logEvent('CLAIM_START', {
            ...info,
            promo_id: result.promo?.id,
            token: promo_token,
            phone: phone,
            metadata: { session_id: result.claim_session_id }
        });

        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: e.message });
    }
});

router.post('/finish', async (req, res) => {
    try {
        const { claim_session_id, phone, name, shared_status, promo_token, lgpd_consent, device_id } = req.body;

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
            device_id || info.deviceId
        );

        // Clear session logic? Maybe keep to prevent replay
        delete req.session.amigos_claim;

        // Log
        AmigosAdminService.logEvent('CLAIM_FINISH', {
            ...info,
            // promo_id? retrieved inside finishClaim, not returned explicitly maybe?
            // logging metadata
            phone: phone,
            metadata: {
                numbers: result.numbers,
                total_qty: result.total_qty
            }
        });

        res.json(result);

    } catch (e) {
        console.error(e);
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
