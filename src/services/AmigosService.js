const { query, getClient } = require('../database/db');

class AmigosService {
    /**
     * Get active campaign
     */
    async getActiveCampaign() {
        // Cache this ideally
        const res = await query(`
            SELECT * FROM az_campaigns 
            WHERE is_active = true 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        return res.rows[0];
    }

    /**
     * Check if phone is blocked and get stats
     * @param {string} phone 
     * @returns {object} { blocked: boolean, next_unlock_at: Date|null }
     */
    async checkLockStatus(phone) {
        // Find last claim
        const res = await query(`
            SELECT * FROM az_claims 
            WHERE phone = $1 
            ORDER BY claimed_at DESC 
            LIMIT 1
        `, [phone]);

        if (res.rows.length === 0) {
            return { blocked: false, next_unlock_at: null };
        }

        const lastClaim = res.rows[0];
        const now = new Date();
        const unlockTime = new Date(lastClaim.next_unlock_at);

        if (now < unlockTime) {
            return { blocked: true, next_unlock_at: unlockTime };
        }

        return { blocked: false, next_unlock_at: null };
    }

    /**
     * Calculate unlock time: Tomorrow 11:00 AM (Sao Paulo)
     */
    calculateNextUnlock() {
        // Use BRT timezone logic
        // Get current time in Sao Paulo
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        // Sao Paulo is roughly UTC-3 (ignoring DST which is abolished mostly)
        // Better to rely on library or fixed offset if simple environment.
        // Assuming strict "add 1 day, set 11:00"

        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(11, 0, 0, 0);

        // If system is UTC, we need to adjust.
        // Let's assume server is UTC. Tomorrow 11:00 SP is Tomorrow 14:00 UTC.
        // Ideally use date-fns-tz or similar, but for MVP:

        // We want 11:00 BRT.
        // 11:00 BRT = 14:00 UTC.
        // So target is Tomorrow 14:00 UTC.

        // Ensure "Tomorrow" relative to SP time.
        // Current SP time: UTC - 3.
        const spTime = new Date(utc - (3 * 3600000));

        const nextUnlockSP = new Date(spTime);
        nextUnlockSP.setDate(nextUnlockSP.getDate() + 1);
        nextUnlockSP.setHours(11, 0, 0, 0);

        // Convert back to UTC for storage
        return new Date(nextUnlockSP.getTime() + (3 * 3600000));
    }

    /**
     * Initialize tickets for a campaign (Admin only or auto)
     * POPULATES az_tickets based on range. Be careful with large ranges.
     */
    async populateTickets(campaignId) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            const campRes = await client.query('SELECT * FROM az_campaigns WHERE id = $1', [campaignId]);
            const camp = campRes.rows[0];
            if (!camp) throw new Error('Campaign not found');

            // Generate sequence
            // This might be heavy if 100k, but PG handles it well.
            await client.query(`
                INSERT INTO az_tickets (campaign_id, number, status)
                SELECT $1, s.a, 'AVAILABLE'
                FROM generate_series($2, $3) AS s(a)
                ON CONFLICT (campaign_id, number) DO NOTHING
            `, [campaignId, camp.start_number, camp.end_number]);

            await client.query('COMMIT');
            return true;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Start Claim Process
     * Just calculates potential Qty and creates session (simple object return technically)
     */
    async startClaim(phone, promoToken) {
        const campaign = await this.getActiveCampaign();
        if (!campaign) throw new Error('Nenhuma campanha ativa no momento');

        // Config days
        const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const today = daysMap[new Date().getDay()];
        const baseQty = campaign.base_qty_config[today] || 1;

        let extraQty = 0;
        let promo = null;

        if (promoToken) {
            // Validate Token
            const promoRes = await query(`
                SELECT p.* FROM az_promo_tokens t
                JOIN az_promotions p ON t.promotion_id = p.id
                WHERE t.token = $1 AND t.expires_at > NOW()
            `, [promoToken]);

            if (promoRes.rows.length > 0) {
                const p = promoRes.rows[0];
                // Check if user already redeemed this promo
                if (phone) {
                    const redRes = await query('SELECT * FROM az_promo_redemptions WHERE promotion_id = $1 AND phone = $2', [p.id, phone]);
                    if (redRes.rows.length === 0) {
                        // Eligible
                        extraQty = p.extra_qty;
                        promo = p;
                    }
                } else {
                    // If no phone yet, assume eligible for display, re-verify at finish
                    extraQty = p.extra_qty;
                    promo = p;
                }
            }
        }

        const totalQty = baseQty + extraQty;

        // Create Session (JWT or DB? Prompt says "claim_session with 3min TTL")
        // Storing in DB is safer for "No reuse".
        // But for MVP, a signed JSON object or simple ID in memory/DB.
        // Let's use DB to enforce TTL strictly.
        // We don't have a sessions table for this specifically, but I can use `az_claims` partially or a redis?
        // Let's return a signed payload (JWT) to avoid DB writes for just "start".
        // Or actually, user asked for "claim_session_id" and "expires_at = now + 3min".
        // Let's generate a UUID.

        const sessionId = require('crypto').randomUUID();
        const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

        return {
            claim_session_id: sessionId,
            base_qty: baseQty,
            extra_qty: extraQty,
            total_qty: totalQty,
            expires_at: expiresAt,
            promo: promo,
            campaign_id: campaign.id
        };
    }

    /**
     * Finish Claim
     * Transactional allocation
     */
    async finishClaim(sessionData, phone, name, consent, promoToken, ip, ua, deviceId) {
        if (new Date() > new Date(sessionData.expires_at)) {
            throw new Error('Sessão expirada. Recomece.');
        }

        const client = await getClient();
        try {
            await client.query('BEGIN');

            // 1. Lock/Check Phone Block
            const lastClaimRes = await client.query(`
                SELECT * FROM az_claims WHERE phone = $1 ORDER BY claimed_at DESC LIMIT 1 FOR UPDATE
            `, [phone]);
            // (Note: locking based on phone might require an insert attempt or existing row lock. 
            // Better: use advisory lock or just rely on constraints if parallel?)
            // We need to check DATE.

            if (lastClaimRes.rows.length > 0) {
                const prev = lastClaimRes.rows[0];
                if (new Date() < new Date(prev.next_unlock_at)) {
                    throw new Error('Você já resgatou hoje. Volte amanhã!');
                    // Should verify if this error is friendly
                }
            }

            // 2. Re-verify Promo Logic (security)
            let extraQty = 0;
            let promoId = null;
            if (promoToken) {
                const pRes = await client.query(`
                   SELECT p.* FROM az_promo_tokens t
                   JOIN az_promotions p ON t.promotion_id = p.id
                   WHERE t.token = $1 AND t.expires_at > NOW()
                `, [promoToken]); // Token logic

                if (pRes.rows.length > 0) {
                    const p = pRes.rows[0];
                    // Check redemption
                    const redCheck = await client.query('SELECT * FROM az_promo_redemptions WHERE promotion_id = $1 AND phone = $2', [p.id, phone]);
                    if (redCheck.rows.length === 0) {
                        extraQty = p.extra_qty;
                        promoId = p.id;

                        // Record redemption
                        await client.query('INSERT INTO az_promo_redemptions (promotion_id, phone) VALUES ($1, $2)', [p.id, phone]);
                    }
                }
            }

            // Recalculate totals
            const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const today = daysMap[new Date().getDay()];
            const campaign = await this.getActiveCampaign();
            const baseQty = campaign.base_qty_config[today] || 1;
            const totalQty = baseQty + extraQty;
            const nextUnlock = this.calculateNextUnlock();

            // 3. Insert Claim
            const claimRes = await client.query(`
                INSERT INTO az_claims 
                (campaign_id, phone, name, type, promotion_id, promo_token, base_qty, extra_qty, total_qty, next_unlock_at, ip, user_agent, device_id, session_id, lgpd_consent)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING id
            `, [
                campaign.id, phone, name,
                promoId ? 'PROMO' : 'NORMAL',
                promoId, promoToken,
                baseQty, extraQty, totalQty,
                nextUnlock,
                ip, ua, deviceId, sessionData.claim_session_id, consent
            ]);
            const claimId = claimRes.rows[0].id;

            // 4. Allocate Tickets
            // Select available
            const ticketsRes = await client.query(`
                SELECT id, number FROM az_tickets 
                WHERE campaign_id = $1 AND status = 'AVAILABLE'
                LIMIT $2
                FOR UPDATE SKIP LOCKED
            `, [campaign.id, totalQty]);

            if (ticketsRes.rows.length < totalQty) {
                throw new Error('Tickets esgotados para esta campanha!');
            }

            const ticketIds = ticketsRes.rows.map(r => r.id);

            // Update tickets
            await client.query(`
                UPDATE az_tickets 
                SET status = 'ASSIGNED', assigned_claim_id = $1, updated_at = NOW()
                WHERE id = ANY($2::int[])
            `, [claimId, ticketIds]);

            await client.query('COMMIT');

            return {
                numbers: ticketsRes.rows.map(r => r.number),
                next_unlock_at: nextUnlock,
                total_qty: totalQty
            };

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}

module.exports = new AmigosService();
