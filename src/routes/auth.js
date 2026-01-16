const express = require('express');
const router = express.Router();
const AuthService = require('../services/AuthService');

/**
 * POST /api/auth/login
 * Body: { phone }
 */
router.post('/login', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Telefone obrigatório' });

        const result = await AuthService.loginByPhone(phone);
        const user = result.user;

        // Create Session
        req.session.userId = user.id;
        req.session.userPhone = user.phone;
        req.session.userName = user.name; // Might be null initially

        res.json({
            success: true,
            user: {
                id: user.id,
                phone: user.phone,
                name: user.name,
                pix_key: user.pix_key
            },
            isNew: result.isNew,
            message: result.isNew ? 'Cadastro realizado!' : 'Login realizado!'
        });

    } catch (e) {
        console.error('[AuthAPI] Login error:', e);
        res.status(500).json({ error: e.message || 'Erro ao realizar login' });
    }
});

/**
 * GET /api/auth/me
 * Get current session user
 */
router.get('/me', async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.json({ loggedIn: false });
    }

    // Refresh data from DB to ensure latest name/pix
    try {
        const user = await AuthService.getUserById(req.session.userId);
        if (!user) {
            req.session.destroy();
            return res.json({ loggedIn: false });
        }

        res.json({
            loggedIn: true,
            user: {
                id: user.id,
                phone: user.phone,
                name: user.name,
                pix_key: user.pix_key
            }
        });
    } catch (e) {
        res.json({ loggedIn: false });
    }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Erro ao sair' });
        res.json({ success: true });
    });
});

/**
 * GET /api/auth/lookup
 * Check if phone exists and return profile data for auto-fill
 * Does NOT create session (just lookup)
 */
router.get('/lookup', async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.json({ found: false });

        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) return res.json({ found: false });

        const user = await AuthService.getUserByPhone(cleanPhone);

        if (user) {
            res.json({
                found: true,
                name: user.name,
                pix_key: user.pix_key,
                zip_code: user.zip_code || null
            });
        } else {
            res.json({ found: false });
        }
    } catch (e) {
        console.error('[AuthAPI] Lookup error:', e);
        res.json({ found: false });
    }
});

/**
 * POST /api/auth/check-pix
 * Check if PIX key is already used by ANOTHER customer (fraud detection)
 */
router.post('/check-pix', async (req, res) => {
    try {
        const { pix_key, phone } = req.body;
        if (!pix_key) return res.json({ duplicate: false });

        const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
        const isDuplicate = await AuthService.isPixDuplicate(pix_key, cleanPhone);

        res.json({ duplicate: isDuplicate });
    } catch (e) {
        console.error('[AuthAPI] PIX check error:', e);
        res.json({ duplicate: false }); // Don't block on error
    }
});

module.exports = router;
