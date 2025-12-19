/**
 * Admin Authentication Routes
 * Handles login, verification, and session management
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const EmailService = require('../services/EmailService');

// Code expiration time (5 minutes)
const CODE_EXPIRATION_MINUTES = 5;

/**
 * GET /admin/login
 * Login page
 */
router.get('/login', (req, res) => {
    // If already logged in, redirect to admin
    if (req.session && req.session.adminId) {
        return res.redirect('/admin');
    }
    res.sendFile('admin-login.html', { root: 'public' });
});

/**
 * GET /admin/setup
 * First-time setup page (requires ADMIN_SETUP_TOKEN)
 */
router.get('/setup', async (req, res) => {
    const { token } = req.query;

    // Validate setup token
    if (!token || token !== process.env.ADMIN_SETUP_TOKEN) {
        return res.status(403).send('Token de setup inválido ou não fornecido');
    }

    // Check if any admin exists
    const existingAdmins = await query('SELECT COUNT(*) as count FROM admin_users');

    res.sendFile('admin-setup.html', { root: 'public' });
});

/**
 * POST /admin/setup
 * Create first admin user
 */
router.post('/setup', async (req, res) => {
    try {
        const { name, email, token } = req.body;

        // Validate setup token
        if (!token || token !== process.env.ADMIN_SETUP_TOKEN) {
            return res.status(403).json({ error: 'Token de setup inválido' });
        }

        // Validate input
        if (!name || !email) {
            return res.status(400).json({ error: 'Nome e email são obrigatórios' });
        }

        // Check if email already exists
        const existing = await query('SELECT id FROM admin_users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        // Create admin user
        await query(
            'INSERT INTO admin_users (name, email) VALUES ($1, $2)',
            [name, email.toLowerCase()]
        );

        console.log(`[AdminAuth] New admin created: ${email}`);

        res.json({ success: true, message: 'Admin cadastrado com sucesso!' });

    } catch (error) {
        console.error('[AdminAuth] Setup error:', error.message);
        res.status(500).json({ error: 'Erro ao criar admin' });
    }
});

/**
 * POST /admin/request-code
 * Request verification code
 */
router.post('/request-code', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email é obrigatório' });
        }

        // Check if admin exists
        const adminResult = await query(
            'SELECT id, name, email FROM admin_users WHERE email = $1 AND is_active = TRUE',
            [email.toLowerCase()]
        );

        if (adminResult.rows.length === 0) {
            // Don't reveal if email exists or not (security)
            return res.json({ success: true, message: 'Se o email estiver cadastrado, você receberá um código' });
        }

        const admin = adminResult.rows[0];

        // Generate code
        const code = EmailService.generateCode();
        const expiresAt = new Date(Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000);

        // Invalidate old codes
        await query(
            'UPDATE admin_verification_codes SET used = TRUE WHERE email = $1 AND used = FALSE',
            [email.toLowerCase()]
        );

        // Save new code
        await query(
            'INSERT INTO admin_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)',
            [email.toLowerCase(), code, expiresAt]
        );

        // Send email
        const sent = await EmailService.sendVerificationCode(admin.email, code, admin.name);

        if (!sent) {
            return res.status(500).json({ error: 'Erro ao enviar email' });
        }

        console.log(`[AdminAuth] Verification code sent to ${email}`);

        res.json({ success: true, message: 'Código enviado para seu email!' });

    } catch (error) {
        console.error('[AdminAuth] Request code error:', error.message);
        res.status(500).json({ error: 'Erro ao enviar código' });
    }
});

/**
 * POST /admin/verify-code
 * Verify code and create session
 */
router.post('/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email e código são obrigatórios' });
        }

        // Find valid code
        const codeResult = await query(`
            SELECT vc.id, vc.code, au.id as admin_id, au.name, au.email
            FROM admin_verification_codes vc
            JOIN admin_users au ON vc.email = au.email
            WHERE vc.email = $1 
              AND vc.code = $2 
              AND vc.used = FALSE 
              AND vc.expires_at > NOW()
              AND au.is_active = TRUE
            ORDER BY vc.created_at DESC
            LIMIT 1
        `, [email.toLowerCase(), code]);

        if (codeResult.rows.length === 0) {
            return res.status(401).json({ error: 'Código inválido ou expirado' });
        }

        const { admin_id, name } = codeResult.rows[0];
        const codeId = codeResult.rows[0].id;

        // Mark code as used
        await query('UPDATE admin_verification_codes SET used = TRUE WHERE id = $1', [codeId]);

        // Update last login
        await query('UPDATE admin_users SET last_login = NOW() WHERE id = $1', [admin_id]);

        // Create session
        req.session.adminId = admin_id;
        req.session.adminName = name;
        req.session.adminEmail = email.toLowerCase();

        console.log(`[AdminAuth] Admin logged in: ${email}`);

        res.json({ success: true, message: 'Login realizado com sucesso!', redirect: '/admin' });

    } catch (error) {
        console.error('[AdminAuth] Verify code error:', error.message);
        res.status(500).json({ error: 'Erro ao verificar código' });
    }
});

/**
 * POST /admin/logout
 * Destroy session
 */
router.post('/logout', (req, res) => {
    if (req.session) {
        const email = req.session.adminEmail;
        req.session.destroy((err) => {
            if (err) {
                console.error('[AdminAuth] Logout error:', err);
                return res.status(500).json({ error: 'Erro ao fazer logout' });
            }
            console.log(`[AdminAuth] Admin logged out: ${email}`);
            res.json({ success: true, redirect: '/admin/login' });
        });
    } else {
        res.json({ success: true, redirect: '/admin/login' });
    }
});

/**
 * GET /admin/me
 * Get current admin info
 */
router.get('/me', (req, res) => {
    if (req.session && req.session.adminId) {
        res.json({
            id: req.session.adminId,
            name: req.session.adminName,
            email: req.session.adminEmail
        });
    } else {
        res.status(401).json({ error: 'Não autenticado' });
    }
});

module.exports = router;
