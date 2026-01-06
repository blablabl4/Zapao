/**
 * Admin Authentication Routes
 * Handles login, verification, and session management
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../middleware/adminAuth');

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

    res.sendFile('admin-setup.html', { root: 'public' });
});

/**
 * POST /admin/setup
 * Create first admin user
 */
router.post('/setup', async (req, res) => {
    try {
        const { name, phone, password, token } = req.body;

        // Validate setup token
        if (!token || token !== process.env.ADMIN_SETUP_TOKEN) {
            return res.status(403).json({ error: 'Token de setup inválido' });
        }

        // Validate input
        if (!name || !phone || !password) {
            return res.status(400).json({ error: 'Nome, telefone e senha são obrigatórios' });
        }

        // Normalize phone
        const cleanPhone = phone.replace(/\D/g, '');

        // Check if phone or email (legacy) already exists
        const existing = await query('SELECT id FROM admin_users WHERE phone = $1', [cleanPhone]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Telefone já cadastrado' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create admin user
        await query(
            'INSERT INTO admin_users (name, phone, password_hash) VALUES ($1, $2, $3)',
            [name, cleanPhone, hashedPassword]
        );

        console.log(`[AdminAuth] New admin created: ${name} (${cleanPhone})`);

        res.json({ success: true, message: 'Admin cadastrado com sucesso!' });

    } catch (error) {
        console.error('[AdminAuth] Setup error:', error.message);
        res.status(500).json({ error: 'Erro ao criar admin' });
    }
});

/**
 * POST /admin/login
 * Login with Phone + Password
 */
router.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Telefone e senha são obrigatórios' });
        }

        const cleanPhone = phone.replace(/\D/g, '');

        // Find admin
        const adminResult = await query(
            'SELECT id, name, phone, password_hash, is_active FROM admin_users WHERE phone = $1',
            [cleanPhone]
        );

        const admin = adminResult.rows[0];

        if (!admin || !admin.is_active) {
            // Generic error for security
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Verify password
        const match = await bcrypt.compare(password, admin.password_hash || '');
        if (!match) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Update last login
        await query('UPDATE admin_users SET last_login = NOW() WHERE id = $1', [admin.id]);

        // Create session
        req.session.adminId = admin.id;
        req.session.adminName = admin.name;
        req.session.adminPhone = admin.phone;

        console.log(`[AdminAuth] Admin logged in: ${admin.id}`);

        res.json({ success: true, message: 'Login realizado com sucesso!', redirect: '/admin' });

    } catch (error) {
        console.error('[AdminAuth] Login error:', error.message);
        res.status(500).json({ error: 'Erro ao realizar login' });
    }
});

/**
 * POST /admin/logout
 * Destroy session
 */
router.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('[AdminAuth] Logout error:', err);
                return res.status(500).json({ error: 'Erro ao fazer logout' });
            }
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
            phone: req.session.adminPhone
        });
    } else {
        res.status(401).json({ error: 'Não autenticado' });
    }
});

// --- Admin Management (Protected) ---

/**
 * GET /admin/list
 * List all admins
 */
router.get('/list', requireAdmin, async (req, res) => {
    try {
        const result = await query('SELECT id, name, phone, email, last_login, created_at FROM admin_users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /admin/check-user
 * Check if user exists and needs first access setup
 */
router.post('/check-user', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Telefone obrigatório' });

        const cleanPhone = phone.toString().trim().replace(/\D/g, '');
        console.log(`[AdminAuth] Check User: Raw=${phone} Clean=${cleanPhone}`);

        const result = await query('SELECT id, name, password_hash, is_active FROM admin_users WHERE phone = $1', [cleanPhone]);

        console.log(`[AdminAuth] Result: Found=${result.rows.length}`);

        if (result.rows.length === 0) {
            return res.json({ exists: false });
        }

        const user = result.rows[0];
        if (!user.is_active) {
            return res.json({ exists: true, active: false });
        }

        // Needs password if hash is null
        const needsPassword = !user.password_hash;

        res.json({
            exists: true,
            active: true,
            needsPassword,
            name: user.name
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao verificar usuário' });
    }
});

/**
 * POST /admin/first-access
 * Set password for the first time
 */
router.post('/first-access', async (req, res) => {
    try {
        const { phone, password } = req.body;
        if (!phone || !password) return res.status(400).json({ error: 'Dados incompletos' });
        if (password.length < 6) return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });

        const cleanPhone = phone.replace(/\D/g, '');

        // Use transaction-like logic: Check if user actually needs password
        const userRes = await query('SELECT id, name, password_hash FROM admin_users WHERE phone = $1', [cleanPhone]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

        const user = userRes.rows[0];
        if (user.password_hash) {
            return res.status(400).json({ error: 'Este usuário já possui senha definida. Faça login.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await query(
            'UPDATE admin_users SET password_hash = $1, last_login = NOW() WHERE id = $2',
            [hashedPassword, user.id]
        );

        // Auto-login (create session)
        req.session.adminId = user.id;
        req.session.adminName = user.name;
        req.session.adminPhone = cleanPhone;

        // Force session save to ensure cookie is set before redirect
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Erro de sessão' });
            }
            res.json({ success: true, message: 'Senha definida com sucesso!', redirect: '/admin' });
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao definir senha' });
    }
});

/**
 * POST /admin/invite
 * Create a new admin (Name + Phone + Optional Password)
 */
router.post('/invite', requireAdmin, async (req, res) => {
    try {
        const { name, phone, password } = req.body;
        if (!name || !phone) return res.status(400).json({ error: 'Nome e telefone obrigatórios' });

        const cleanPhone = phone.replace(/\D/g, '');

        // Check existing
        const existing = await query('SELECT id FROM admin_users WHERE phone = $1', [cleanPhone]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Telefone já cadastrado' });

        let hashedPassword = null;
        if (password && password.trim().length > 0) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        await query('INSERT INTO admin_users (name, phone, password_hash) VALUES ($1, $2, $3)',
            [name, cleanPhone, hashedPassword]);

        res.json({ success: true, message: 'Admin convidado com sucesso' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /admin/:id
 * Remove admin
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const targetId = parseInt(req.params.id);
        const currentId = req.session.adminId;

        if (targetId === currentId) {
            return res.status(400).json({ error: 'Você não pode se excluir.' });
        }

        await query('DELETE FROM admin_users WHERE id = $1', [targetId]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
