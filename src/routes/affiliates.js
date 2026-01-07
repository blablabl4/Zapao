const express = require('express');
const router = express.Router();
const AffiliateService = require('../services/AffiliateService');

// Check status
router.get('/check/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 10) return res.status(400).json({ error: 'Telefone inválido' });

        const result = await AffiliateService.checkStatus(cleanPhone);
        res.json(result);
    } catch (e) {
        console.error('Affiliate check error:', e);
        res.status(500).json({ error: 'Erro ao verificar afiliado' });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { phone, name, pix_key } = req.body;

        // Basic validation
        const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
        if (!cleanPhone || cleanPhone.length < 10) {
            return res.status(400).json({ error: 'Telefone inválido' });
        }
        if (!name || !pix_key) {
            return res.status(400).json({ error: 'Nome e Chave Pix são obrigatórios' });
        }

        const result = await AffiliateService.register(cleanPhone, name.trim(), pix_key.trim());
        res.json({ success: true, data: result });
    } catch (e) {
        console.error('Affiliate register error:', e);
        res.status(500).json({ error: 'Erro ao cadastrar afiliado' });
    }
});

// Public Ranking (No revenue, just names and counts for competition)
router.get('/ranking', async (req, res) => {
    try {
        const DrawService = require('../services/DrawService');
        const currentDraw = await DrawService.getCurrentDraw();

        if (!currentDraw) {
            return res.json({ ranking: [] });
        }

        const stats = await DrawService.getAffiliateStats(currentDraw.id);

        console.log('[Affiliate Ranking] Raw stats:', JSON.stringify(stats, null, 2));

        // Return only name and ticket count (no revenue for public)
        // ONLY show affiliates with real names (already searched in affiliates + orders tables)
        const publicRanking = stats
            .filter(s => s.padrinho_name && s.padrinho_name.trim() !== '' && s.ticket_count > 0)
            .map((s, index) => ({
                position: index + 1,
                name: s.padrinho_name,
                referrals: s.ticket_count
            }));

        console.log('[Affiliate Ranking] Public ranking:', JSON.stringify(publicRanking, null, 2));

        res.json({ ranking: publicRanking });
    } catch (e) {
        console.error('Affiliate ranking error:', e);
        res.status(500).json({ error: 'Erro ao carregar ranking' });
    }
});

module.exports = router;
