const { query, getClient } = require('../database/db');
const OrderService = require('./OrderService');

class DrawService {
    constructor() {
        this.prizeBase = parseFloat(process.env.PRIZE_BASE_AMOUNT || '100.00');
    }

    /**
     * Get current active draw or create one if none exists
     * @returns {object} Current draw with calculated current_prize
     */
    async getCurrentDraw() {

        // Now including PAUSED so the frontend can show the "Paused" state
        const result = await query(`
            SELECT * FROM draws 
            WHERE status IN ('ACTIVE', 'SCHEDULED', 'PAUSED') 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        let draw = result.rows[0];

        if (!draw) {
            // NO AUTO-CREATION! Admin must create raffles manually
            console.log('[DrawService] No active draw found. Admin must create one.');
            return null;
        }

        // Calculate current prize (base + reserve)
        draw.current_prize = parseFloat(draw.prize_base) + parseFloat(draw.reserve_amount);
        draw.sales_locked = Boolean(draw.sales_locked);
        // Ensure total_numbers is returned (defaults to 75 if null)
        draw.total_numbers = draw.total_numbers || 75;

        return draw;
    }

    /**
     * Update current draw's end_time and/or prize_base
     * @param {object} updates - { end_time, prize_base }
     * @returns {object} Updated draw
     */
    async updateCurrentDraw(updates) {
        const currentDraw = await this.getCurrentDraw();

        const setClauses = [];
        const values = [];
        let paramCount = 1;

        if (updates.end_time) {
            setClauses.push(`end_time = $${paramCount++}`);
            values.push(updates.end_time);
        }

        if (updates.prize_base !== undefined) {
            setClauses.push(`prize_base = $${paramCount++}`);
            values.push(updates.prize_base);
        }

        if (setClauses.length === 0) {
            return currentDraw;
        }

        values.push(currentDraw.id);

        const result = await query(`
            UPDATE draws 
            SET ${setClauses.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `, values);

        const draw = result.rows[0];
        draw.current_prize = parseFloat(draw.prize_base) + parseFloat(draw.reserve_amount);

        console.log(`[DrawService] Updated draw #${draw.id}, new end_time: ${draw.end_time}`);

        return draw;
    }

    /**
     * Start a draw (admin action)
     * @param {string} drawName - Name of the draw
     * @param {number} prizeBase - Base prize amount
     * @param {Date} startTime - When to start
     * @returns {object} Started draw
     */
    async startDraw(drawName, prizeBase, startTime = new Date()) {
        const durationMinutes = 60; // 1 hour windows
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

        const result = await query(`
            INSERT INTO draws (draw_name, status, prize_base, reserve_amount, start_time, end_time, duration_minutes, sales_locked)
            VALUES ($1, 'ACTIVE', $2, 0.00, $3, $4, $5, FALSE)
            RETURNING *
        `, [drawName, prizeBase, startTime, endTime, durationMinutes]);

        const draw = result.rows[0];
        draw.current_prize = parseFloat(draw.prize_base) + parseFloat(draw.reserve_amount);

        console.log(`[DrawService] Started draw #${draw.id}: ${drawName} (ends at ${endTime.toISOString()})`);

        return draw;
    }

    /**
     * Start a draw with explicit end time (for scheduled draws)
     * @param {string} drawName - Name of the draw
     * @param {number} prizeBase - Base prize amount
     * @param {Date} startTime - When started
     * @param {Date} endTime - When draw should happen
     * @returns {object} Started draw
     */
    async startDrawWithEndTime(drawName, prizeBase, startTime, endTime) {
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000));

        const result = await query(`
            INSERT INTO draws (draw_name, status, prize_base, reserve_amount, start_time, end_time, duration_minutes, sales_locked)
            VALUES ($1, 'ACTIVE', $2, 0.00, $3, $4, $5, FALSE)
            RETURNING *
        `, [drawName, prizeBase, startTime, endTime, durationMinutes]);

        const draw = result.rows[0];
        draw.current_prize = parseFloat(draw.prize_base) + parseFloat(draw.reserve_amount);

        console.log(`[DrawService] Started scheduled draw #${draw.id}: ${drawName} (ends at ${endTime.toISOString()})`);

        return draw;
    }

    /**
     * Check and auto-lock draws that reached end_time
     * Called by background job
     */
    async checkDrawExpiration() {
        const now = new Date();

        const result = await query(`
            UPDATE draws 
            SET sales_locked = TRUE, lock_time = $1
            WHERE status = 'ACTIVE' 
              AND end_time <= $1 
              AND sales_locked = FALSE
            RETURNING *
        `, [now]);

        if (result.rows.length > 0) {
            console.log(`[DrawService] Auto-locked ${result.rows.length} draw(s) due to expiration`);
        }

        return result.rows;
    }

    /**
     * Close current draw and calculate winners
     * @param {number} drawn_number - The winning number (0-99)
     * @returns {object} Draw result with winners
     */
    async closeDraw(drawn_number) {
        if (!Number.isInteger(drawn_number) || drawn_number < 0 || drawn_number > 99) {
            throw new Error('Drawn number must be between 0 and 99');
        }

        const client = await getClient();

        try {
            await client.query('BEGIN');

            // Get current active draw
            const currentDraw = await this.getCurrentDraw();
            if (!currentDraw || currentDraw.status !== 'ACTIVE') {
                throw new Error('No active draw found');
            }

            // Get all paid orders for the drawn number
            const winners = await OrderService.getPaidOrdersByNumber(drawn_number, currentDraw.id);
            const winnersCount = winners.length;

            const currentPrize = currentDraw.current_prize;
            let payoutEach = 0;
            let newReserveAmount = 0;

            if (winnersCount > 0) {
                // Winners found - divide prize among them
                payoutEach = currentPrize / winnersCount;
                newReserveAmount = 0; // Reset reserve
                console.log(`[DrawService] Draw #${currentDraw.id} closed - ${winnersCount} winner(s) - R$ ${payoutEach.toFixed(2)} each`);
            } else {
                // No winners - add to reserve for next draw
                newReserveAmount = parseFloat(currentDraw.reserve_amount) + parseFloat(this.prizeBase);
                payoutEach = 0;
                console.log(`[DrawService] Draw #${currentDraw.id} closed - No winners - Prize added to reserve (R$ ${newReserveAmount.toFixed(2)})`);
            }

            // Update current draw
            await client.query(`
                UPDATE draws 
                SET status = 'CLOSED',
                    drawn_number = $1,
                    closed_at = $2,
                    winners_count = $3,
                    payout_each = $4
                WHERE id = $5
            `, [drawn_number, new Date(), winnersCount, payoutEach, currentDraw.id]);

            await client.query('COMMIT');

            console.log(`[DrawService] Draw closed. Auto-creation disabled.`);

            return {
                draw_id: currentDraw.id,
                drawn_number,
                winners_count: winnersCount,
                payout_each: payoutEach,
                total_prize: currentPrize,
                reserve_used: parseFloat(currentDraw.reserve_amount),
                new_reserve: newReserveAmount,
                winners: winners.map(w => ({
                    order_id: w.order_id,
                    paid_at: w.paid_at,
                    amount: parseFloat(w.amount),
                    buyer_ref: w.buyer_ref,
                    buyer_ref: w.buyer_ref,
                    buyer_name: w.buyer.name, // Export parsed name
                    city: w.buyer.city || '',
                    bairro: w.buyer.bairro || ''
                }))
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get draw history
     * @param {number} limit - Number of draws to return
     * @returns {Array} Past draws
     */
    async getDrawHistory(limit = 10) {
        const result = await query(`
            SELECT * FROM draws 
            WHERE status = 'CLOSED'
            ORDER BY closed_at DESC
            LIMIT $1
        `, [limit]);

        return result.rows;
    }

    /**
     * Get all winners across all draws
     */
    async getAllWinners() {
        const result = await query(`
            SELECT 
                d.id as draw_id,
                d.draw_name,
                d.drawn_number,
                d.closed_at,
                d.payout_each,
                o.buyer_ref,
                o.created_at as order_date
            FROM draws d
            JOIN orders o ON o.draw_id = d.id AND o.number = d.drawn_number
            WHERE d.status = 'CLOSED' AND o.status = 'PAID'
            ORDER BY d.closed_at DESC
        `);

        return result.rows.map(row => {
            const parts = (row.buyer_ref || '').split('|');
            return {
                draw_name: row.draw_name,
                number: row.drawn_number,
                prize: parseFloat(row.payout_each),
                date: row.order_date, // Use specific purchase time
                winner: {
                    name: parts[0] || 'Desconhecido',
                    phone: parts[1] || '-',
                    pix: parts[2] || '-'
                }
            };
        });
    }

    /**
     * Get public draws list (Active & Closed)
     */
    async getPublicDraws() {
        // Get all draws
        const drawsRes = await query(`
            SELECT * FROM draws 
            ORDER BY id ASC
        `);

        const draws = drawsRes.rows;
        const result = [];

        for (const draw of draws) {
            let winners = [];
            if (draw.status === 'CLOSED') {
                // Get winners for this draw
                const winnersRes = await query(`
                    SELECT o.number, o.buyer_ref, o.created_at
                    FROM orders o
                    WHERE o.draw_id = $1 AND o.status = 'PAID' AND o.number = $2
                `, [draw.id, draw.drawn_number]);

                winners = winnersRes.rows.map(w => {
                    const parts = (w.buyer_ref || '').split('|');
                    // Format New: Name|Phone|Pix|Bairro|City|CEP
                    // Format Legacy: Name|Phone|Pix|Bairro|City

                    // Robust extraction attempting to find Bairro/City
                    // Index 3 is usually Bairro, Index 4 is usually City

                    let bairro = parts[3] || 'Bairro';
                    let city = parts[4] || 'Cidade';

                    // Basic cleanup if data is weird (like BATCH ids)
                    if (bairro.includes('BATCH') || bairro.length > 30) bairro = '';
                    if (city.includes('BATCH')) city = 'Brasil';

                    return {
                        number: w.number,
                        name: parts[0] ? parts[0].split(' ')[0] + ' ' + (parts[0].split(' ')[1] || '') : 'Ganhador',
                        phone: parts[1] || '',
                        pix: parts[2] || '',
                        date: w.created_at,
                        city: city,
                        bairro: bairro
                    };
                });
            }

            result.push({
                id: draw.id,
                name: draw.draw_name,
                prize: parseFloat(draw.current_prize || draw.prize_base), // Support legacy
                status: draw.status,
                total_numbers: draw.total_numbers || 75,
                winners: winners,
                winning_number: draw.drawn_number
            });
        }

        return result;
    }

    /**
     * Get admin statistics
     * @returns {object} Admin stats
     */
    async getAdminStats() {
        const currentDraw = await this.getCurrentDraw();

        if (!currentDraw) {
            // Return empty/default stats if no active draw
            return {
                current_draw: {
                    id: null,
                    draw_name: 'Nenhuma Rifa Ativa',
                    prize_base: this.prizeBase, // 100.00
                    reserve_amount: 0,
                    current_prize: this.prizeBase, // 100.00
                    is_reinforced: false,
                    sales_locked: true,
                    start_time: null,
                    end_time: null,
                    status: 'INACTIVE'
                },
                orders: {
                    paid_total: 0,
                    revenue_total_paid: 0
                }
            };
        }

        const orderStats = await OrderService.getStats(currentDraw.id); // Filter by current draw

        // Ensure current_prize is calculated (it should be set by getCurrentDraw, but fallback just in case)
        const calculatedPrize = currentDraw.current_prize ||
            (parseFloat(currentDraw.prize_base || 0) + parseFloat(currentDraw.reserve_amount || 0));

        return {
            current_draw: {
                id: currentDraw.id,
                draw_name: currentDraw.draw_name || 'Rodada Atual',
                prize_base: parseFloat(currentDraw.prize_base || 0),
                reserve_amount: parseFloat(currentDraw.reserve_amount || 0),
                current_prize: calculatedPrize,
                is_reinforced: parseFloat(currentDraw.reserve_amount || 0) > 0,
                sales_locked: currentDraw.sales_locked || false,
                start_time: currentDraw.start_time,
                end_time: currentDraw.end_time,
                status: currentDraw.status || 'ACTIVE',
                scheduled_for: currentDraw.scheduled_for
            },
            orders: {
                paid_total: orderStats.paid_total || 0,
                transactions_total: orderStats.transactions_total || 0,
                revenue_total_paid: orderStats.revenue_total_paid || 0,
                unique_customers: orderStats.unique_customers || 0
            }
        };
    }

    /**
     * Get top 10 most drawn numbers
     * @param {number} days - Look back period in days (0 = all time)
     * @returns {Array} Hot numbers with draw count
     */
    async getHotNumbers(days = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        let whereClause = "WHERE status = 'CLOSED'";
        let params = [];

        if (days > 0) {
            whereClause += " AND closed_at >= $1";
            params.push(cutoffDate);
        }

        const result = await query(`
            SELECT drawn_number, COUNT(*) as times_drawn
            FROM draws
            ${whereClause}
            AND drawn_number IS NOT NULL
            GROUP BY drawn_number
            ORDER BY times_drawn DESC, drawn_number ASC
            LIMIT 10
        `, params);

        return result.rows.map(row => ({
            number: row.drawn_number,
            times_drawn: parseInt(row.times_drawn)
        }));
    }

    /**
     * Toggle sales lock for current draw
     * @param {boolean} locked - Lock status
     * @returns {object} Updated draw
     */
    async toggleSalesLock(locked) {
        const currentDraw = await this.getCurrentDraw();
        const lockTime = locked ? new Date() : null;

        await query('UPDATE draws SET sales_locked = $1, lock_time = $2 WHERE id = $3',
            [locked, lockTime, currentDraw.id]);

        console.log(`[DrawService] Sales ${locked ? 'locked' : 'unlocked'} for draw #${currentDraw.id}`);

        return this.getCurrentDraw();
    }

    /**
     * Toggle PAUSE status for current draw
     * @param {boolean} paused - Pause status
     * @returns {object} Updated draw
     */
    async togglePause(paused) {
        const currentDraw = await this.getCurrentDraw();

        // Cannot pause a closed draw
        if (currentDraw.status === 'CLOSED') {
            throw new Error('Não é possível pausar uma rifa encerrada');
        }

        const newStatus = paused ? 'PAUSED' : 'ACTIVE';
        const salesLocked = paused; // Pause always locks sales

        await query('UPDATE draws SET status = $1, sales_locked = $2 WHERE id = $3',
            [newStatus, salesLocked, currentDraw.id]);

        console.log(`[DrawService] Draw #${currentDraw.id} status set to ${newStatus}`);

        return this.getCurrentDraw();
    }
    /**
     * Get Affiliate Stats for a Draw (Candidate List)
     * @param {number} drawId
     */
    async getAffiliateStats(drawId) {
        // Count paid tickets, revenue, and clicks per referrer
        // Using CTEs to aggregate separately to avoid multiplication in joins
        const result = await query(`
            WITH sales_stats AS (
                SELECT referrer_id, COUNT(*) as ticket_count, SUM(amount) as total_revenue
                FROM orders 
                WHERE draw_id = $1 
                  AND status = 'PAID' 
                  AND referrer_id IS NOT NULL 
                  AND referrer_id != ''
                GROUP BY referrer_id
            ),
            click_stats AS (
                SELECT referrer_id, COUNT(*) as click_count
                FROM affiliate_clicks
                WHERE draw_id = $1
                  AND referrer_id IS NOT NULL
                  AND referrer_id != ''
                GROUP BY referrer_id
            )
            SELECT 
                COALESCE(s.referrer_id, c.referrer_id) as referrer_id,
                COALESCE(s.ticket_count, 0) as ticket_count,
                COALESCE(s.total_revenue, 0) as total_revenue,
                COALESCE(c.click_count, 0) as access_count
            FROM sales_stats s
            FULL OUTER JOIN click_stats c ON s.referrer_id = c.referrer_id
            ORDER BY ticket_count DESC, total_revenue DESC
        `, [drawId]);

        // Enrich with padrinho names by looking up orders where the referrer was the buyer
        const enrichedResults = [];
        for (const row of result.rows) {
            let padrinhoName = '';
            let padrinhoPhone = '';

            try {
                // Decode referrer_id (base64 of PHONE-DRAWID)
                const decoded = Buffer.from(row.referrer_id, 'base64').toString('utf-8');
                if (decoded.includes('-')) {
                    padrinhoPhone = decoded.split('-')[0];

                    // Find orders where this phone appears in buyer_ref
                    const orderRes = await query(`
                        SELECT buyer_ref FROM orders 
                        WHERE buyer_ref LIKE $1 AND status = 'PAID'
                        LIMIT 1
                    `, [`%|${padrinhoPhone}|%`]);

                    if (orderRes.rows.length > 0) {
                        const parts = (orderRes.rows[0].buyer_ref || '').split('|');
                        padrinhoName = parts[0] || '';
                    }
                }
            } catch (e) {
                // If decode fails, use referrer_id as-is
                padrinhoPhone = row.referrer_id.substring(0, 11);
            }

            enrichedResults.push({
                referrer_id: row.referrer_id,
                padrinho_name: padrinhoName,
                padrinho_phone: padrinhoPhone,
                ticket_count: parseInt(row.ticket_count),
                total_revenue: parseFloat(row.total_revenue || 0),
                access_count: parseInt(row.access_count || 0)
            });
        }

        return enrichedResults;
    }

    /**
     * Perform Secondary Draw for Affiliates
     * @param {number} drawId
     */
    async performAffiliateDraw(drawId) {
        const stats = await this.getAffiliateStats(drawId);

        if (stats.length === 0) {
            throw new Error('Nenhum afiliado elegível para este sorteio.');
        }

        // Create weighted pool (virtual urn)
        // Instead of massive array, we use cumulative weights for performance
        let totalTickets = 0;
        const pool = [];

        for (const candidate of stats) {
            totalTickets += candidate.ticket_count;
            pool.push({
                referrer_id: candidate.referrer_id,
                rangeEnd: totalTickets,
                tickets: candidate.ticket_count
            });
        }

        // Pick random ticket 1 to totalTickets
        const winningTicket = Math.floor(Math.random() * totalTickets) + 1;

        // Find winner
        const winner = pool.find(p => winningTicket <= p.rangeEnd);

        return {
            winner_referrer_id: winner.referrer_id,
            winning_ticket_index: winningTicket,
            total_tickets: totalTickets,
            candidates_count: stats.length,
            candidate_tickets: winner.tickets
        };
    }
}

module.exports = new DrawService();
