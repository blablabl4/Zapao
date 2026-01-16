/**
 * ScratchCardService - Complete Scratchcard Logic
 * 
 * Rules:
 * - 1 scratchcard per R$ 10.50 spent
 * - 20% win chance when eligible
 * - 1 max win per customer per draw
 * - Teaser: No R$ 225 min, affiliates can win
 * - Post-Teaser: R$ 225 min, affiliates get near-miss only
 * - Near-miss for all losses (💰💰❌)
 */

const { query } = require('../database/db');
const crypto = require('crypto');

class ScratchCardService {

    /**
     * Generate scratchcards for a paid order
     * @param {Object} order - The paid order
     * @returns {Array} Array of generated scratchcard tokens
     */
    async generateForOrder(order) {
        console.log('[SCRATCH_DEBUG] generateForOrder called with:', {
            orderId: order.order_id,
            customerId: order.customer_id,
            drawId: order.draw_id,
            amount: order.amount
        });

        const config = await this.getConfig();

        console.log('[SCRATCH_DEBUG] Config loaded:', config);

        if (config.enabled !== 'true') {
            console.log('[Scratch] Feature disabled, skipping generation');
            return [];
        }

        // Get customer context
        const customerId = order.customer_id;
        const drawId = order.draw_id;

        if (!customerId || !drawId) {
            console.log('[Scratch] Missing customer_id or draw_id, skipping cumulative check');
            return [];
        }

        // --- CUMULATIVE LOGIC START ---
        // 1. Get TOTAL numbers purchased by this customer in this draw
        // Each order = 1 number (structure from /api/orders/bulk)
        const numberCountResult = await query(`
            SELECT COUNT(*) as total_numbers 
            FROM orders 
            WHERE customer_id = $1 AND draw_id = $2 AND status = 'PAID'
        `, [customerId, drawId]);

        let totalNumbers = parseInt(numberCountResult.rows[0].total_numbers) || 0;

        // Add CURRENT batch orders (count based on batchSize passed from payment)
        if (order.status !== 'PAID') {
            const currentBatchCount = order.batchSize || 1;
            totalNumbers += currentBatchCount;
            console.log(`[Scratch] Adding pending batch count: ${currentBatchCount}`);
        }

        console.log(`[SCRATCH_DEBUG] Number count: DB=${parseInt(numberCountResult.rows[0].total_numbers) || 0}, Current=1, Status=${order.status}, Total=${totalNumbers}`);

        // 2. Count scratchcards ALREADY issued for this customer in this draw
        const issuedResult = await query(`
            SELECT COUNT(*) as count 
            FROM scratchcards 
            WHERE customer_id = $1 AND draw_id = $2
        `, [customerId, drawId]);

        const alreadyIssued = parseInt(issuedResult.rows[0].count) || 0;

        // 3. Calculate how many they SHOULD have (7 numbers = 1 card)
        const minNumbers = parseInt(config.min_numbers_per_card) || 7;
        const totalShouldHave = Math.floor(totalNumbers / minNumbers);

        // 4. Determine new cards to generate
        const cardsToGenerate = totalShouldHave - alreadyIssued;

        console.log(`[Scratch] Quantity Check: Numbers=${totalNumbers}, Min=${minNumbers}, Should Have: ${totalShouldHave}, Issued: ${alreadyIssued}, Generating: ${cardsToGenerate}`);

        if (cardsToGenerate <= 0) {
            console.log(`[SCRATCH_DEBUG] No cards to generate (totalShouldHave=${totalShouldHave}, alreadyIssued=${alreadyIssued})`);
            return [];
        }

        const cardCount = cardsToGenerate;
        // --- CUMULATIVE LOGIC END ---

        // Check if order is from affiliate (tag new cards based on CURRENT order source)
        const isAffiliate = !!(order.referrer_id || order.affiliate_id);

        const tokens = [];
        for (let i = 0; i < cardCount; i++) {
            const token = this.generateToken();

            await query(`
                INSERT INTO scratchcards (customer_id, order_id, draw_id, token, is_affiliate_order)
                VALUES ($1, $2, $3, $4, $5)
            `, [customerId, order.order_id, drawId, token, isAffiliate]);

            tokens.push(token);
        }

        console.log(`[Scratch] Generated ${cardCount} cards for order ${order.id} (affiliate: ${isAffiliate})`);
        return tokens;
    }

    /**
     * Get scratchcard by token
     */
    async getByToken(token) {
        const result = await query('SELECT * FROM scratchcards WHERE token = $1', [token]);
        return result.rows[0];
    }

    /**
     * Get pending scratchcards for a customer
     */
    async getPendingByCustomer(customerId) {
        const result = await query(`
            SELECT s.*, d.title as draw_title, d.prize_value as draw_prize
            FROM scratchcards s
            JOIN draws d ON s.draw_id = d.id
            WHERE s.customer_id = $1 AND s.status = 'PENDING'
            ORDER BY s.created_at DESC
        `, [customerId]);
        return result.rows;
    }

    /**
     * Get pending scratchcards by order (for post-payment modal)
     */
    async getPendingByOrder(orderId) {
        const result = await query(`
            SELECT * FROM scratchcards 
            WHERE order_id = $1 AND status = 'PENDING'
            ORDER BY created_at ASC
        `, [orderId]);
        return result.rows;
    }

    /**
     * CORE LOGIC: Reveal a scratchcard
     */
    async reveal(token) {
        const card = await this.getByToken(token);
        if (!card) throw new Error('Raspadinha não encontrada');
        if (card.status !== 'PENDING') {
            return {
                alreadyRevealed: true,
                isWinner: card.is_winner,
                prizeValue: card.prize_value,
                grid: JSON.parse(card.generated_grid || '[]')
            };
        }

        const config = await this.getConfig();
        const customer = await this.getCustomer(card.customer_id);

        // Get draw info for revenue calculation
        const draw = await this.getDraw(card.draw_id);
        if (!draw) throw new Error('Rifa não encontrada');

        // Check if customer already won this draw
        const alreadyWon = await this.hasCustomerWonDraw(card.customer_id, card.draw_id);
        if (alreadyWon) {
            return this.markAsLoss(card, 'Já ganhou nesta rifa', config);
        }

        // Get direct revenue (excluding affiliate sales)
        const directRevenue = await this.getDirectRevenue(card.draw_id);
        const prizeValue = parseFloat(draw.prize_value) || 0;
        const revenuePercent = prizeValue > 0 ? (directRevenue / prizeValue) * 100 : 0;

        // Find available tier
        const tier = await this.findAvailableTier(card.draw_id, revenuePercent, card.is_affiliate_order, customer, config);

        if (!tier) {
            return this.markAsLoss(card, 'Sem prêmios disponíveis', config);
        }

        // Roll the dice (20% chance)
        const winChance = parseFloat(config.win_chance_percent) / 100;
        const roll = Math.random();
        const isWinner = roll < winChance;

        if (isWinner) {
            // Increment prizes given
            await query('UPDATE scratch_prize_tiers SET prizes_given = prizes_given + 1 WHERE id = $1', [tier.id]);
            // Reset luck points
            await query('UPDATE customers SET luck_points = 0 WHERE id = $1', [card.customer_id]);

            return this.markAsWinner(card, tier.prize_value, tier.tier_name);
        } else {
            // Increment luck points (pity timer)
            await query('UPDATE customers SET luck_points = luck_points + 1 WHERE id = $1', [card.customer_id]);

            return this.markAsLoss(card, 'Não premiada', config);
        }
    }

    /**
     * Find available prize tier based on current state
     */
    async findAvailableTier(drawId, revenuePercent, isAffiliate, customer, config) {
        // Get all tiers for this draw ordered by revenue_percent ASC
        const result = await query(`
            SELECT * FROM scratch_prize_tiers 
            WHERE draw_id = $1 
            ORDER BY revenue_percent ASC
        `, [drawId]);

        const tiers = result.rows;
        const minSpent = parseFloat(config.min_customer_spent) || 225;
        const customerSpent = parseFloat(customer?.total_spent) || 0;

        for (const tier of tiers) {
            // Check if tier is unlocked based on revenue
            if (revenuePercent < tier.revenue_percent) continue;

            // Check if tier has prizes left
            if (tier.prizes_given >= tier.prizes_available) continue;

            // Check affiliate restriction
            if (isAffiliate && !tier.allows_affiliate) continue;

            // Check min spent requirement (except teaser)
            if (tier.requires_min_spent && customerSpent < minSpent) continue;

            // This tier is available
            return tier;
        }

        return null;
    }

    /**
     * Mark card as winner
     */
    async markAsWinner(card, prizeValue, tierName) {
        const grid = this.generateWinningGrid();

        await query(`
            UPDATE scratchcards 
            SET status = 'REVEALED', is_winner = TRUE, prize_value = $1, 
                prize_tier = $2, generated_grid = $3, revealed_at = NOW()
            WHERE id = $4
        `, [prizeValue, tierName, JSON.stringify(grid), card.id]);

        console.log(`[Scratch] 🎉 WINNER! Card ${card.token} won R$ ${prizeValue} (${tierName})`);

        return {
            isWinner: true,
            prizeValue: parseFloat(prizeValue),
            grid,
            message: `🎉 Você ganhou R$ ${prizeValue}!`
        };
    }

    /**
     * Mark card as loss with near-miss
     */
    async markAsLoss(card, reason, config) {
        const grid = this.generateNearMissGrid();

        await query(`
            UPDATE scratchcards 
            SET status = 'REVEALED', is_winner = FALSE, prize_value = 0, 
                generated_grid = $1, revealed_at = NOW()
            WHERE id = $2
        `, [JSON.stringify(grid), card.id]);

        console.log(`[Scratch] Card ${card.token} lost: ${reason}`);

        return {
            isWinner: false,
            prizeValue: 0,
            grid,
            message: '😢 Quase! Tente novamente!'
        };
    }

    /**
     * Claim a winning scratchcard
     */
    async claim(token, pixKey) {
        const card = await this.getByToken(token);
        if (!card) throw new Error('Raspadinha não encontrada');
        if (card.status !== 'REVEALED') throw new Error('Raspadinha ainda não foi revelada');
        if (!card.is_winner) throw new Error('Esta raspadinha não foi premiada');
        if (card.status === 'CLAIMED') throw new Error('Prêmio já resgatado');

        await query(`
            UPDATE scratchcards 
            SET status = 'CLAIMED', claimed_at = NOW()
            WHERE id = $1
        `, [card.id]);

        console.log(`[Scratch] Card ${token} claimed! Prize: R$ ${card.prize_value}`);

        return {
            success: true,
            prizeValue: card.prize_value,
            message: 'Prêmio registrado! Você receberá via PIX em breve.'
        };
    }

    /**
     * Expire all pending scratchcards for closed draws
     */
    async expireForClosedDraws() {
        const result = await query(`
            UPDATE scratchcards s
            SET status = 'EXPIRED'
            FROM draws d
            WHERE s.draw_id = d.id 
            AND d.status = 'CLOSED'
            AND s.status = 'PENDING'
            RETURNING s.id
        `);

        if (result.rowCount > 0) {
            console.log(`[Scratch] Expired ${result.rowCount} scratchcards from closed draws`);
        }
        return result.rowCount;
    }

    /**
     * Get unclaimed winning cards (for admin)
     */
    async getUnclaimedWinners() {
        const result = await query(`
            SELECT s.*, c.name as customer_name, c.phone, c.pix_key,
                   d.title as draw_title
            FROM scratchcards s
            JOIN customers c ON s.customer_id = c.id
            JOIN draws d ON s.draw_id = d.id
            WHERE s.is_winner = TRUE AND s.status IN ('REVEALED', 'CLAIMED')
            ORDER BY s.revealed_at DESC
        `);
        return result.rows;
    }

    // ================= HELPERS =================

    async getConfig() {
        const result = await query('SELECT key, value FROM scratch_config');
        const config = {};
        result.rows.forEach(row => { config[row.key] = row.value; });
        return config;
    }

    async getCustomer(customerId) {
        const result = await query('SELECT * FROM customers WHERE id = $1', [customerId]);
        return result.rows[0];
    }

    async getDraw(drawId) {
        const result = await query('SELECT * FROM draws WHERE id = $1', [drawId]);
        return result.rows[0];
    }

    async getDirectRevenue(drawId) {
        const result = await query(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM orders 
            WHERE draw_id = $1 
            AND referrer_id IS NULL 
            AND status = 'PAID'
        `, [drawId]);
        return parseFloat(result.rows[0].total) || 0;
    }

    async hasCustomerWonDraw(customerId, drawId) {
        const result = await query(`
            SELECT COUNT(*) as count FROM scratchcards 
            WHERE customer_id = $1 AND draw_id = $2 AND is_winner = TRUE
        `, [customerId, drawId]);
        return parseInt(result.rows[0].count) > 0;
    }

    generateToken() {
        return crypto.randomBytes(16).toString('hex');
    }

    generateWinningGrid() {
        // Símbolos: 💰 (prize), 🎟️ (bonus card), ❌ (loss)
        // Win condition: 3 símbolos IGUAIS em qualquer posição
        const winSymbol = Math.random() < 0.6 ? '💰' : '🎟️'; // 60% dinheiro, 40% bônus
        const otherSymbols = ['💰', '🎟️', '❌'].filter(s => s !== winSymbol);

        const grid = Array(9).fill(null);

        // Coloca 3 símbolos vencedores em posições aleatórias
        const winPositions = [];
        while (winPositions.length < 3) {
            const pos = Math.floor(Math.random() * 9);
            if (!winPositions.includes(pos)) winPositions.push(pos);
        }
        winPositions.forEach(pos => grid[pos] = winSymbol);

        // Preenche os outros 6 slots com símbolos variados (nunca 3 iguais)
        for (let i = 0; i < 9; i++) {
            if (!grid[i]) {
                // Conta quantos de cada símbolo já existem
                const counts = {
                    '💰': grid.filter(s => s === '💰').length,
                    '🎟️': grid.filter(s => s === '🎟️').length,
                    '❌': grid.filter(s => s === '❌').length
                };

                // Remove símbolos que já têm 2+ (para evitar outra sequência de 3)
                const available = otherSymbols.filter(s => (counts[s] || 0) < 2);
                grid[i] = available.length > 0
                    ? available[Math.floor(Math.random() * available.length)]
                    : otherSymbols[Math.floor(Math.random() * otherSymbols.length)];
            }
        }

        return grid; // Array[9]
    }

    generateNearMissGrid() {
        // Near-miss: 2 do mesmo símbolo (quase ganhou!)
        const almostWin = Math.random() < 0.7 ? '💰' : '🎟️'; // Maioria quase ganha dinheiro
        const allSymbols = ['💰', '🎟️', '❌'];

        const grid = Array(9).fill(null);

        // Coloca exatamente 2 símbolos "quase vencedores"
        const positions = [];
        while (positions.length < 2) {
            const pos = Math.floor(Math.random() * 9);
            if (!positions.includes(pos)) positions.push(pos);
        }
        positions.forEach(pos => grid[pos] = almostWin);

        // Preenche resto com variação (NUNCA permitir 3 iguais)
        for (let i = 0; i < 9; i++) {
            if (!grid[i]) {
                // Conta quantos de cada símbolo já tem
                const counts = {
                    '💰': grid.filter(s => s === '💰').length,
                    '🎟️': grid.filter(s => s === '🎟️').length,
                    '❌': grid.filter(s => s === '❌').length
                };

                // Remove símbolos que já têm 2 (para garantir que NUNCA tenha 3 iguais)
                const available = allSymbols.filter(s => (counts[s] || 0) < 2);
                grid[i] = available[Math.floor(Math.random() * available.length)];
            }
        }

        return grid; // Array[9]
    }
}

module.exports = new ScratchCardService();
