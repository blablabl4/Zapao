const { query, getClient } = require('../database/db');
const OrderService = require('./OrderService');

class DrawService {
    constructor() {
        this.prizeBase = parseFloat(process.env.PRIZE_BASE_AMOUNT || '500.00');
    }

    /**
     * Get current active draw or create one if none exists
     * @returns {object} Current draw with calculated current_prize
     */
    async getCurrentDraw() {
        const result = await query(`
            SELECT * FROM draws 
            WHERE status IN ('ACTIVE', 'SCHEDULED') 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        let draw = result.rows[0];

        if (!draw) {
            // Create first draw (SCHEDULED until admin starts it)
            const insertResult = await query(`
                INSERT INTO draws (draw_name, status, prize_base, reserve_amount, sales_locked, duration_minutes)
                VALUES ($1, 'SCHEDULED', $2, 0.00, FALSE, 60)
                RETURNING *
            `, ['Rodada Inicial', this.prizeBase]);

            draw = insertResult.rows[0];
            console.log(`[DrawService] Created new draw #${draw.id}`);
        }

        // Calculate current prize (base + reserve)
        draw.current_prize = parseFloat(draw.prize_base) + parseFloat(draw.reserve_amount);
        draw.sales_locked = Boolean(draw.sales_locked);

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
            const winners = await OrderService.getPaidOrdersByNumber(drawn_number);
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

            // Create next draw with updated reserve
            await client.query(`
                INSERT INTO draws (draw_name, status, prize_base, reserve_amount, sales_locked)
                VALUES ($1, 'SCHEDULED', $2, $3, FALSE)
            `, ['Próxima Rodada', this.prizeBase, newReserveAmount]);

            await client.query('COMMIT');

            console.log(`[DrawService] Created next draw with reserve R$ ${newReserveAmount.toFixed(2)}`);

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
                    buyer_ref: w.buyer_ref
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
     * Get admin statistics
     * @returns {object} Admin stats
     */
    async getAdminStats() {
        const currentDraw = await this.getCurrentDraw();
        const orderStats = await OrderService.getStats();

        return {
            current_draw: {
                id: currentDraw.id,
                draw_name: currentDraw.draw_name,
                prize_base: parseFloat(currentDraw.prize_base),
                reserve_amount: parseFloat(currentDraw.reserve_amount),
                current_prize: currentDraw.current_prize,
                is_reinforced: parseFloat(currentDraw.reserve_amount) > 0,
                sales_locked: currentDraw.sales_locked,
                start_time: currentDraw.start_time,
                end_time: currentDraw.end_time,
                status: currentDraw.status
            },
            orders: {
                paid_total: orderStats.paid_total,
                revenue_total_paid: orderStats.revenue_total_paid
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
}

module.exports = new DrawService();
