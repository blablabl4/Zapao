const express = require('express');
const router = express.Router();
const { query } = require('../database/db');

// POST /api/bolao/validate-lookup - Search participant by CPF or Phone
router.post('/validate-lookup', async (req, res) => {
    try {
        const { identifier } = req.body; // CPF or Phone

        if (!identifier || identifier.length < 10) {
            return res.status(400).json({ error: 'CPF ou telefone inválido' });
        }

        // Clean the identifier (remove non-digits)
        const cleaned = identifier.replace(/\D/g, '');

        // Search by phone or cpf
        const result = await query(`
            SELECT 
                c.name,
                c.phone,
                c.cpf,
                c.round_number,
                c.total_qty,
                c.status
            FROM az_claims c
            WHERE c.campaign_id = 21 
              AND c.status = 'PAID'
              AND (
                  REPLACE(REPLACE(c.phone, '-', ''), ' ', '') LIKE $1
                  OR REPLACE(REPLACE(c.cpf, '.', ''), '-', '') = $2
              )
            ORDER BY c.round_number
        `, [`%${cleaned}%`, cleaned]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Participante não encontrado',
                message: 'Não encontramos participação com esse CPF ou telefone.'
            });
        }

        // Group by game
        const games = {};
        let totalCotas = 0;
        const firstName = result.rows[0].name;
        const phone = result.rows[0].phone;

        result.rows.forEach(row => {
            const jogo = row.round_number;
            if (!games[jogo]) {
                games[jogo] = 0;
            }
            games[jogo] += parseInt(row.total_qty) || 1;
            totalCotas += parseInt(row.total_qty) || 1;
        });

        res.json({
            success: true,
            name: firstName,
            phone: phone,
            games: games, // { "1": 2, "2": 1, ... }
            totalCotas: totalCotas
        });

    } catch (error) {
        console.error('Validation lookup error:', error);
        res.status(500).json({ error: 'Erro ao buscar participação' });
    }
});

// POST /api/bolao/validate-confirm - Confirm participation is correct
router.post('/validate-confirm', async (req, res) => {
    try {
        const { phone, name, games } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        await query(`
            INSERT INTO az_bolao_validations (phone, name, status, games_shown, ip_address, user_agent)
            VALUES ($1, $2, 'confirmed', $3, $4, $5)
        `, [phone, name, JSON.stringify(games), ip, userAgent]);

        res.json({
            success: true,
            message: 'Participação confirmada! Boa sorte! 🍀'
        });

    } catch (error) {
        console.error('Validation confirm error:', error);
        res.status(500).json({ error: 'Erro ao confirmar participação' });
    }
});

// POST /api/bolao/validate-dispute - Report participation error
router.post('/validate-dispute', async (req, res) => {
    try {
        const { phone, name, games } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        await query(`
            INSERT INTO az_bolao_validations (phone, name, status, games_shown, ip_address, user_agent)
            VALUES ($1, $2, 'disputed', $3, $4, $5)
        `, [phone, name, JSON.stringify(games), ip, userAgent]);

        res.json({
            success: true,
            message: 'Recebemos sua solicitação. Entraremos em contato em breve.'
        });

    } catch (error) {
        console.error('Validation dispute error:', error);
        res.status(500).json({ error: 'Erro ao registrar solicitação' });
    }
});

// GET /api/bolao/validations - List all validations (admin)
router.get('/validations', async (req, res) => {
    try {
        const { status } = req.query;

        let sql = `
            SELECT id, phone, name, status, games_shown, validated_at, ip_address
            FROM az_bolao_validations
        `;

        const params = [];
        if (status && status !== 'all') {
            sql += ` WHERE status = $1`;
            params.push(status);
        }

        sql += ` ORDER BY validated_at DESC LIMIT 100`;

        const result = await query(sql, params);

        res.json({
            success: true,
            validations: result.rows
        });

    } catch (error) {
        console.error('Get validations error:', error);
        res.status(500).json({ error: 'Erro ao carregar validações' });
    }
});

module.exports = router;
