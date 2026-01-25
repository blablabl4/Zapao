const { query, getClient } = require('../database/db');
const { getRandomName } = require('../utils/names');

class AmigosService {
    constructor() {
        // Simple in-memory cache for active campaign
        this._campaignCache = {
            data: null,
            expiresAt: 0
        };
    }

    /**
     * Get active campaign (Cached 60s)
     */
    /**
     * Invalidate campaign cache
     * Called when Admin updates/creates a campaign
     */
    invalidateCache() {
        console.log('[AmigosService] Cache invalidated');
        this._campaignCache = { data: null, expiresAt: 0 };
    }

    /**
     * Get active campaign (Cached 60s)
     */
    async getActiveCampaign() {
        const now = Date.now();
        if (this._campaignCache.data && now < this._campaignCache.expiresAt) {
            return this._campaignCache.data;
        }

        const res = await query(`
            SELECT * FROM az_campaigns 
            WHERE is_active = true 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        const campaign = res.rows[0];

        // Update cache
        if (campaign) {
            this._campaignCache.data = campaign;
            this._campaignCache.expiresAt = now + 5 * 1000; // Reduced TTL to 5s to reflect Admin changes faster
        } else {
            // Negative cache (shorter TTL)
            this._campaignCache.data = null;
            this._campaignCache.expiresAt = now + 5 * 1000;
        }

        return campaign;
    }

    /**
     * Toggle House Winner for a campaign
     * @param {number} campaignId 
     * @param {boolean} active 
     */
    async toggleHouseWinner(campaignId, active) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            const campRes = await client.query('SELECT * FROM az_campaigns WHERE id = $1', [campaignId]);
            const camp = campRes.rows[0];
            if (!camp) throw new Error('Campanha não encontrada');

            if (active) {
                // ENABLE
                if (camp.house_winner_active) {
                    await client.query('COMMIT');
                    return { message: 'Já estava ativo', number: camp.house_winner_number, name: camp.house_winner_name };
                }

                // 1. Pick a random available ticket WITHIN RANGE explicitly
                // We lock a row to avoid concurrency issues
                const ticketRes = await client.query(`
                    SELECT id, number FROM az_tickets 
                    WHERE campaign_id = $1 
                    AND status = 'AVAILABLE'
                    AND number >= $2 AND number <= $3
                    ORDER BY RANDOM()
                    LIMIT 1
                    FOR UPDATE
                `, [campaignId, camp.start_number, camp.end_number]);

                if (ticketRes.rows.length === 0) {
                    throw new Error('Não há tickets disponíveis para reservar para a casa.');
                }

                const ticket = ticketRes.rows[0];
                const { getComplexIdentity } = require('../utils/names');
                const identity = getComplexIdentity();
                // Format: "Name Surname - Location"
                const houseName = `${identity.name} - ${identity.location}`;

                // 2. Mark ticket as RESERVED
                await client.query(`
                    UPDATE az_tickets 
                    SET status = 'HOUSE_RESERVED', updated_at = NOW() 
                    WHERE id = $1
                `, [ticket.id]);

                // 3. Update Campaign
                await client.query(`
                    UPDATE az_campaigns 
                    SET house_winner_active = true, 
                        house_winner_number = $1, 
                        house_winner_name = $2 
                    WHERE id = $3
                `, [ticket.number, houseName, campaignId]);

                await client.query('COMMIT');
                this.invalidateCache();
                return { active: true, number: ticket.number, name: houseName };

            } else {
                // DISABLE
                if (!camp.house_winner_active) {
                    await client.query('COMMIT');
                    return { message: 'Já estava inativo' };
                }

                const houseNumber = camp.house_winner_number;

                // 1. Find the reserved ticket and free it
                if (houseNumber !== null) {
                    await client.query(`
                        UPDATE az_tickets 
                        SET status = 'AVAILABLE', updated_at = NOW() 
                        WHERE campaign_id = $1 AND number = $2 AND status = 'HOUSE_RESERVED'
                    `, [campaignId, houseNumber]);
                }

                // 2. Update Campaign
                await client.query(`
                    UPDATE az_campaigns 
                    SET house_winner_active = false, 
                        house_winner_number = NULL, 
                        house_winner_name = NULL 
                    WHERE id = $1
                `, [campaignId]);

                await client.query('COMMIT');
                this.invalidateCache();
                return { active: false };
            }

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Get promotion by token
     */
    async getPromoByToken(token) {
        const res = await query(`
            SELECT p.* FROM az_promo_tokens t
            JOIN az_promotions p ON t.promotion_id = p.id
            WHERE t.token = $1 AND t.expires_at > NOW()
        `, [token]);
        return res.rows[0] || null;
    }

    /**
     * Check if phone is blocked (Daily Limit)
     * Only checks 'NORMAL' claims
     * @param {string} phone 
     * @returns {object} { blocked: boolean, next_unlock_at: Date|null }
     */
    async checkLockStatus(phone) {
        // Find last DAILY claim
        const res = await query(`
            SELECT * FROM az_claims 
            WHERE phone = $1 AND type = 'NORMAL'
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
     * Calculate unlock time: Tomorrow 11:00 AM (Brasília - UTC-3)
     */
    calculateNextUnlock() {
        const now = new Date();
        const spOffset = -3;
        const spNow = new Date(now.getTime() + (spOffset * 60 * 60 * 1000));
        const nextUnlockSP = new Date(spNow);
        nextUnlockSP.setDate(nextUnlockSP.getDate() + 1);
        nextUnlockSP.setUTCHours(11, 0, 0, 0);
        const nextUnlockUTC = new Date(nextUnlockSP.getTime() - (spOffset * 60 * 60 * 1000));
        return nextUnlockUTC;
    }

    /**
     * Initialize tickets for a campaign (Admin only or auto)
     * POPULATES az_tickets based on range. Be careful with large ranges.
     * UPDATED: Now inserts SHUFFLED tickets to allow faster retrieval (LIMIT 1)
     */
    async populateTickets(campaignId) {
        console.log('[AmigosService] populateTickets called with campaignId:', campaignId);
        const client = await getClient();
        try {
            await client.query('BEGIN');

            const campRes = await client.query('SELECT * FROM az_campaigns WHERE id = $1', [campaignId]);
            const camp = campRes.rows[0];
            console.log('[AmigosService] Campaign found:', camp ? `${camp.name} (${camp.start_number} - ${camp.end_number})` : 'NOT FOUND');

            if (!camp) throw new Error('Campaign not found');

            const startNum = parseInt(camp.start_number);
            const endNum = parseInt(camp.end_number);
            const total = endNum - startNum + 1;

            console.log('[AmigosService] Generating tickets from', startNum, 'to', endNum, `(Total: ${total})`);

            if (total > 100000) {
                throw new Error(`Range muito grande (${total} números). O limite é 100.000 por segurança.`);
            }

            // Create array of numbers
            const numbers = Array.from({ length: total }, (_, i) => startNum + i);

            // Fisher-Yates Shuffle (O(N)) - In-place
            // Only shuffle if total < 50000 to save memory/cpu, otherwise sequential is safer?
            // Actually shuffle is key for fair distribution of "low/high" numbers if fetched sequentially.
            // We keep shuffle but log time.
            console.time('Shuffle');
            for (let i = numbers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
            }
            console.timeEnd('Shuffle');

            console.log('[AmigosService] Tickets shuffled. Starting bulk insert...');

            // Bulk Insert (chunks of 2000 to be safer on Railway free tier RAM)
            const chunkSize = 2000;
            let insertedCount = 0;

            const currentRound = camp.current_round || 1;
            console.log(`[AmigosService] Using Round: ${currentRound}`);

            for (let i = 0; i < numbers.length; i += chunkSize) {
                const chunk = numbers.slice(i, i + chunkSize);

                // Construct values string: ($1, num1, round, 'AVAILABLE')...
                const values = chunk.map(n => `(${campaignId}, ${n}, ${currentRound}, 'AVAILABLE')`).join(',');

                const res = await client.query(`
                    INSERT INTO az_tickets (campaign_id, number, round_number, status)
                    VALUES ${values}
                    ON CONFLICT (campaign_id, number, round_number) DO NOTHING
                `);
                insertedCount += res.rowCount;
            }

            console.log('[AmigosService] Total INSERT result rowCount:', insertedCount);

            // Remove tickets outside range (only if available) to ensure sync
            const deleteRes = await client.query(`
                DELETE FROM az_tickets 
                WHERE campaign_id = $1 
                AND status = 'AVAILABLE'
                AND (number < $2 OR number > $3)
            `, [campaignId, startNum, endNum]);

            console.log('[AmigosService] DELETE result rowCount:', deleteRes.rowCount);

            await client.query('COMMIT');

            // Verify count
            const countRes = await client.query('SELECT COUNT(*) as c FROM az_tickets WHERE campaign_id = $1', [campaignId]);
            console.log('[AmigosService] Final ticket count for campaign:', countRes.rows[0].c);

            return { inserted: insertedCount, deleted: deleteRes.rowCount, total: countRes.rows[0].c };
        } catch (e) {
            console.error('[AmigosService] populateTickets ERROR:', e);
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

        let baseQty = campaign.base_qty_config[today] || 1;
        let extraQty = 0;
        let promo = null;

        if (promoToken) {
            // Validate Token
            const promoRes = await query(`
                SELECT p.* FROM az_promo_tokens t
                JOIN az_promotions p ON t.promotion_id = p.id
                WHERE t.token = $1 AND t.expires_at > NOW()
            `, [promoToken]);

            if (promoRes.rows.length === 0) {
                // Token is invalid, expired, or promotion was deleted
                throw new Error('Link promocional inválido ou expirado. Acesse a página principal.');
            }

            const p = promoRes.rows[0];

            // Check if promo dates are valid
            const now = new Date();
            if (p.starts_at && new Date(p.starts_at) > now) {
                throw new Error('Esta promoção ainda não começou.');
            }
            if (p.ends_at && new Date(p.ends_at) < now) {
                throw new Error('Esta promoção já encerrou.');
            }

            // Check if user already redeemed this promo
            if (phone) {
                const redRes = await query('SELECT * FROM az_promo_redemptions WHERE promotion_id = $1 AND phone = $2', [p.id, phone]);
                if (redRes.rows.length > 0) {
                    throw new Error('Você já utilizou esta promoção antes.');
                }
            }

            // Fix: Promo claims ONLY give the specific promo extra quantity. Base daily quantity is 0.
            baseQty = 0;
            extraQty = p.extra_qty;
            promo = p;
        }

        const totalQty = baseQty + extraQty;

        // Generate Session ID (Robust UUID v4)
        const generateUUID = () => {
            try {
                const crypto = require('crypto');
                if (crypto.randomUUID) return crypto.randomUUID();
                return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                    (c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16)
                );
            } catch (e) {
                // Fallback for very old environments
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
        };

        const sessionId = generateUUID();
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
    async finishClaim(sessionData, phone, name, consent, promoToken, ip, ua, deviceId, cep) {
        if (new Date() > new Date(sessionData.expires_at)) {
            throw new Error('Sessão expirada. Recomece.');
        }

        // Fix: fetch campaign to ensure valid reference
        const campaign = await this.getActiveCampaign();
        if (!campaign) throw new Error('Nenhuma campanha ativa.');

        const client = await getClient();
        try {
            await client.query('BEGIN');

            let extraQty = 0;
            let promoId = null;
            let isPromo = false;

            // 1. Validate Promo (If exists)
            if (promoToken) {
                const pRes = await client.query(`
                   SELECT p.* FROM az_promo_tokens t
                   JOIN az_promotions p ON t.promotion_id = p.id
                   WHERE t.token = $1 AND t.expires_at > NOW()
                `, [promoToken]);

                if (pRes.rows.length > 0) {
                    const p = pRes.rows[0];
                    // Check redemption UNIQUE for this promo
                    const redCheck = await client.query('SELECT * FROM az_promo_redemptions WHERE promotion_id = $1 AND phone = $2', [p.id, phone]);
                    if (redCheck.rows.length > 0) {
                        throw new Error('Você já resgatou esta promoção!');
                    }

                    extraQty = p.extra_qty;
                    promoId = p.id;
                    isPromo = true;

                    // Record redemption
                    await client.query('INSERT INTO az_promo_redemptions (promotion_id, phone) VALUES ($1, $2)', [p.id, phone]);
                }
            }

            // --- NEW SECURITY CHECKS ---

            // 0. Clean Phone
            const cleanPhone = phone.replace(/\D/g, '');

            // 1. Whitelist Check (Strict but OPTIONAL if list is empty)
            /* 
               DISABLED TEMPORARILY PER USER REQUEST (Urgent Fix)
               The system was blocking users even when intended to be open.
               To re-enable, uncomment this block and ensure list clearing works.
            
            // First check if whitelist has ANY entries
            const listCheck = await client.query('SELECT 1 FROM az_whitelist LIMIT 1');
            const isWhitelistActive = listCheck.rowCount > 0;

            if (isWhitelistActive) {
                const whiteRes = await client.query('SELECT 1 FROM az_whitelist WHERE phone = $1', [cleanPhone]);
                if (whiteRes.rowCount === 0) {
                    // Must be specific message for UI to potentially handle trigger
                    throw new Error('ENTRE NO GRUPO PARA PARTICIPAR! Seu número não está na lista de convidados.');
                }
            }
            */

            // 2. Single Participation Check (Strict)
            // User Request: 1 number per PERSON per RAFFLE (Campaign)
            const prevClaim = await client.query('SELECT 1 FROM az_claims WHERE campaign_id = $1 AND phone = $2 LIMIT 1', [campaign.id, phone]);
            if (prevClaim.rowCount > 0) {
                throw new Error('Você já garantiu seu número da sorte! É permitido apenas 1 número por pessoa neste sorteio.');
            }

            // 3. FORCE QTY = 1 (Ignore any other logic)
            const baseQty = 1;
            extraQty = 0;
            const totalQty = 1;
            const nextUnlock = new Date(); // Satisfy NOT NULL constraint even if unused

            // ---------------------------

            // 3. Insert Claim
            const claimRes = await client.query(`
                INSERT INTO az_claims 
                (campaign_id, phone, name, type, promotion_id, promo_token, base_qty, extra_qty, total_qty, next_unlock_at, ip, user_agent, device_id, session_id, lgpd_consent, cep)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING id
            `, [
                campaign.id, phone, name,
                isPromo ? 'PROMO' : 'NORMAL', // Fix: Use 'PROMO' if it is a promo claim
                promoId, promoToken,
                baseQty, extraQty, totalQty,
                nextUnlock,
                ip, ua, deviceId, sessionData.claim_session_id, consent, cep
            ]);
            const claimId = claimRes.rows[0].id;

            // 4. Allocate Tickets
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
                next_unlock_at: nextUnlock || null, // Return null if promo
                total_qty: totalQty
            };

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Finish Campaign (Deactivate)
     */
    async finishCampaign(campaignId) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // 1. Deactivate
            await client.query(`
                UPDATE az_campaigns 
                SET is_active = false, 
                    house_winner_active = false,
                    updated_at = NOW()
                WHERE id = $1
            `, [campaignId]);

            // 2. Clear house reserved tickets (just in case)
            // Ideally we keep them as is for history, but status 'HOUSE_RESERVED' is fine to stay.
            // But to be clean we might want to ensure no pending mechanics are left.
            // Leaving them as HOUSE_RESERVED is fine for history.

            await client.query('COMMIT');
            this.invalidateCache();
            return { success: true };
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}
module.exports = new AmigosService();
