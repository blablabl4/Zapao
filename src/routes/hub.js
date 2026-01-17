const express = require('express');
const router = express.Router();
const GroupHubService = require('../services/GroupHubService');
const { requireAdmin } = require('../middleware/adminAuth');
const { query } = require('../database/db');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Public Config
router.get('/config', async (req, res) => {
    try {
        const config = await GroupHubService.getConfig();
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Track Click (when someone visits /hub?ref=TOKEN)
router.post('/track-click', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.json({ tracked: false });

        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        await query(
            `INSERT INTO hub_clicks (affiliate_token, ip_address, user_agent) VALUES ($1, $2, $3)`,
            [token, ip.split(',')[0], userAgent.substring(0, 500)]
        );

        res.json({ tracked: true });
    } catch (e) {
        console.error('Click track error:', e.message);
        res.json({ tracked: false });
    }
});

// Join Hub
router.post('/join', async (req, res) => {
    try {
        const { name, phone, referrer } = req.body;
        if (!name || !phone) {
            return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
        }

        const result = await GroupHubService.joinHub({
            name,
            phone,
            referrerToken: referrer
        });

        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Get My Info (for returning users or dashboard)
router.get('/me/:token', async (req, res) => {
    try {
        const lead = await GroupHubService.getLeadByToken(req.params.token);
        if (!lead) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(lead);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin: Create Group
router.post('/groups', requireAdmin, async (req, res) => {
    try {
        const { name, link, capacity } = req.body;
        const group = await GroupHubService.createGroup(name, link, capacity);
        res.json(group);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin: Validate CSV
router.post('/validate-csv', requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Arquivo CSV/Excel obrigatório' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        // Expected format: { 'Telefone': '...', 'Link': '...' } or similar
        // We will map keys loosely
        const cleanData = data.map(row => ({
            phone: (row['Telefone'] || row['phone'] || row['Celular'] || '').toString(),
            group_link: (row['Grupo'] || row['Link'] || row['group'] || '').toString()
        }));

        const report = await GroupHubService.validateLeads(cleanData);

        // Cleanup
        fs.unlinkSync(req.file.path);

        res.json(report);
    } catch (e) {
        console.error(e);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
