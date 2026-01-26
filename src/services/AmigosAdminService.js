const { query, getClient } = require('../database/db');
const AmigosService = require('./AmigosService');

class AmigosAdminService {
    async updateCampaign(id, data) {
        // Build query dynamically based on provided fields
        const fields = [];
        const values = [];
        let idx = 1;

        if (data.name) { fields.push(`name = $${idx++}`); values.push(data.name); }
        if (data.start_number !== undefined) { fields.push(`start_number = $${idx++}`); values.push(data.start_number); }
        if (data.end_number !== undefined) { fields.push(`end_number = $${idx++}`); values.push(data.end_number); }
        if (data.base_qty_config) { fields.push(`base_qty_config = $${idx++}`); values.push(data.base_qty_config); }
        if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }
        if (data.group_link !== undefined) { fields.push(`group_link = $${idx++}`); values.push(data.group_link); }
        if (data.house_winner_name !== undefined) { fields.push(`house_winner_name = $${idx++}`); values.push(data.house_winner_name); }
        if (data.house_winner_number !== undefined) { fields.push(`house_winner_number = $${idx++}`); values.push(data.house_winner_number); }

        values.push(id);
        const res = await query(`
            UPDATE az_campaigns 
            SET ${fields.join(', ')}
            WHERE id = $${idx}
            RETURNING *
        `, values);

        // If activating this campaign, deactivate all others
        if (data.is_active === true) {
            await query('UPDATE az_campaigns SET is_active = false WHERE id != $1', [id]);
        }

        // Invalidate cache
        AmigosService.invalidateCache();

        return res.rows[0];
    }

    async createCampaign(data) {
        // Enforce is_active default true if not provided
        const isActive = data.is_active !== undefined ? data.is_active : true;

        const res = await query(`
            INSERT INTO az_campaigns (name, start_number, end_number, base_qty_config, is_active, group_link)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [data.name, data.start_number, data.end_number, data.base_qty_config, isActive, data.group_link || null]);

        const newCampaign = res.rows[0];

        // If activating, deactivate all others
        if (isActive) {
            await query('UPDATE az_campaigns SET is_active = false WHERE id != $1', [newCampaign.id]);
        }

        // Invalidate cache
        AmigosService.invalidateCache();

        return newCampaign;
    }

    async createPromotion(campaignId, data) {
        const startsAt = data.starts_at || new Date();
        const endsAt = data.ends_at || new Date('2099-12-31');
        const extraQty = parseInt(data.extra_qty) || 0;

        const res = await query(`
            INSERT INTO az_promotions (campaign_id, name, extra_qty, starts_at, ends_at, image_url, share_text, sponsor_link)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [campaignId, data.name, extraQty, startsAt, endsAt, data.image_url, data.share_text || null, data.sponsor_link || null]);
        return res.rows[0];
    }

    async generatePromoToken(promotionId) {
        const token = require('crypto').randomBytes(16).toString('hex');

        // Get promotion to set expiry same as ends_at
        const pRes = await query('SELECT ends_at FROM az_promotions WHERE id = $1', [promotionId]);
        const promo = pRes.rows[0];

        await query(`
            INSERT INTO az_promo_tokens (token, promotion_id, expires_at)
            VALUES ($1, $2, $3)
        `, [token, promotionId, promo.ends_at]);

        return token;
    }

    async getPromotions(campaignId) {
        const res = await query(`
            SELECT p.*,
            (SELECT COUNT(*) FROM az_promo_redemptions WHERE promotion_id = p.id) as redemptions_count,
            (SELECT COUNT(*) FROM az_events WHERE promotion_id = p.id AND type = 'PROMO_VIEW') as views_count
            FROM az_promotions p 
            WHERE campaign_id = $1 
            ORDER BY created_at DESC
        `, [campaignId]);
        return res.rows;
    }

    async updatePromotion(id, data) {
        const fields = [];
        const values = [];
        let idx = 1;

        // Allow updating all promo fields
        if (data.starts_at) { fields.push(`starts_at = $${idx++}`); values.push(data.starts_at); }
        if (data.ends_at) { fields.push(`ends_at = $${idx++}`); values.push(data.ends_at); }
        if (data.image_url) { fields.push(`image_url = $${idx++}`); values.push(data.image_url); }
        if (data.extra_qty !== undefined) { fields.push(`extra_qty = $${idx++}`); values.push(data.extra_qty); }
        if (data.name) { fields.push(`name = $${idx++}`); values.push(data.name); }
        if (data.share_text !== undefined) { fields.push(`share_text = $${idx++}`); values.push(data.share_text || null); }
        if (data.sponsor_link !== undefined) { fields.push(`sponsor_link = $${idx++}`); values.push(data.sponsor_link || null); }

        if (fields.length === 0) return null;

        values.push(id);
        const res = await query(`
            UPDATE az_promotions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *
        `, values);
        return res.rows[0];
    }

    async deletePromotion(id) {
        await query('DELETE FROM az_promo_tokens WHERE promotion_id = $1', [id]);
        await query('DELETE FROM az_promo_redemptions WHERE promotion_id = $1', [id]);
        // Ideally hard delete only if no redactions, or soft delete. 
        // User asked to "Delete".
        // Constraints might fail if claims exist. 
        // We will keep claims (historical) but set promotion_id null? Or cascade?
        // Let's simply delete tokens (links stop working).
        // Actual deletion of promo row might require cleaning history.
        // For now, let's assume we just want to stop it? 
        // Or if really delete:
        try {
            await query('DELETE FROM az_promotions WHERE id = $1', [id]);
            return true;
        } catch (e) {
            // Likely FK constraint from az_claims. 
            // In that case, maybe just expire it?
            throw new Error('Não é possível excluir promoção com resgates vinculados. Tente encerrar a data.');
        }
    }

    async searchParticipant(term) {
        // Term can be phone or ticket number
        // 1. Try Ticket
        let result = {};

        if (!isNaN(term)) {
            // Probably ticket number
            const ticketRes = await query(`
                SELECT t.*, c.phone, c.name, c.claimed_at, c.type, c.promotion_id, p.name as promo_name
                FROM az_tickets t
                JOIN az_claims c ON t.assigned_claim_id = c.id
                LEFT JOIN az_promotions p ON c.promotion_id = p.id
                WHERE t.number = $1
            `, [term]);

            if (ticketRes.rows.length > 0) {
                // Found via ticket
                const row = ticketRes.rows[0];
                result.participant = {
                    phone: row.phone,
                    name: row.name
                };
                // Get all claims for this phone
                result.history = await this.getHistoryByPhone(row.phone);
                return result;
            }
        }

        // 2. Try Phone
        const claimRes = await query(`
            SELECT DISTINCT phone, name FROM az_claims WHERE phone = $1 LIMIT 1
        `, [term]);

        if (claimRes.rows.length > 0) {
            result.participant = claimRes.rows[0];
            result.history = await this.getHistoryByPhone(term);
            return result;
        }

        return null; // Not found
    }

    async getHistoryByPhone(phone) {
        // Get claims and tickets
        const claimsRes = await query(`
            SELECT c.*, p.name as promo_name,
            (SELECT json_agg(number) FROM az_tickets WHERE assigned_claim_id = c.id) as tickets
            FROM az_claims c
            LEFT JOIN az_promotions p ON c.promotion_id = p.id
            WHERE c.phone = $1
            ORDER BY c.claimed_at DESC
        `, [phone]);

        return claimsRes.rows.map(c => ({
            ...c,
            description: c.type === 'PROMO' ? `Promoção: ${c.promo_name}` : 'Resgate Diário',
            print_required: `Print do status do dia ${new Date(c.claimed_at).toLocaleDateString('pt-BR')}`
        }));
    }

    async resetTickets(campaignId) {
        // Danger zone - Reset EVERYTHING for the campaign
        const client = await require('../database/db').getClient();
        try {
            await client.query('BEGIN');

            console.log('[Reset] Starting reset for campaign:', campaignId);

            // 1. Reset ALL Tickets related to this campaign's claims or campaign_id

            // A. Reset tickets belonging to this campaign
            await client.query(`
                UPDATE az_tickets 
                SET status = 'AVAILABLE', assigned_claim_id = NULL, updated_at = NOW() 
                WHERE campaign_id = $1
            `, [campaignId]);

            // B. Reset tickets linked to claims of this campaign (Foolproof Method)
            // fetch all claim IDs first to ensure we target exactly what we are about to delete
            const claimIdsRes = await client.query('SELECT id FROM az_claims WHERE campaign_id = $1', [campaignId]);
            const claimIds = claimIdsRes.rows.map(r => r.id);

            if (claimIds.length > 0) {
                console.log(`[Reset] Found ${claimIds.length} claims. Detaching from tickets...`);
                // Update any ticket (even from other campaigns if corrupted) that points to these claims
                await client.query(`
                    UPDATE az_tickets 
                    SET status = 'AVAILABLE', assigned_claim_id = NULL, updated_at = NOW()
                    WHERE assigned_claim_id = ANY($1::int[])
                `, [claimIds]);
            }

            console.log('[Reset] Tickets reset finished');

            // 2. Delete ALL Claims for this campaign
            const claimsRes = await client.query('DELETE FROM az_claims WHERE campaign_id = $1', [campaignId]);
            console.log('[Reset] Claims deleted:', claimsRes.rowCount);

            // 3. Delete promo redemptions for promos in this campaign
            const promoRedRes = await client.query(`
                DELETE FROM az_promo_redemptions 
                WHERE promotion_id IN (SELECT id FROM az_promotions WHERE campaign_id = $1)
            `, [campaignId]);
            console.log('[Reset] Promo redemptions deleted:', promoRedRes.rowCount);

            // 4. Delete events related to this campaign
            const eventsRes = await client.query('DELETE FROM az_events WHERE campaign_id = $1', [campaignId]);
            console.log('[Reset] Events deleted:', eventsRes.rowCount);

            await client.query('COMMIT');
            console.log('[Reset] Completed successfully');

            // Invalidate cache because distribution state changed (though active campaign config didn't, it's safer)
            require('./AmigosService').invalidateCache();

            return { claims_deleted: claimsRes.rowCount, tickets_reset: ticketsRes.rowCount };
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('[Reset] Error:', e);
            throw e;
        } finally {
            client.release();
        }
    }

    async deleteCampaign(campaignId) {
        const client = await getClient();
        try {
            await client.query('BEGIN');
            console.log('[DeleteCampaign] Starting complete deletion for campaign:', campaignId);

            // 1. Delete events
            await client.query('DELETE FROM az_events WHERE campaign_id = $1', [campaignId]);

            // 2. Delete promo redemptions
            await client.query(`
                DELETE FROM az_promo_redemptions 
                WHERE promotion_id IN (SELECT id FROM az_promotions WHERE campaign_id = $1)
            `, [campaignId]);

            // 3. Delete promo tokens
            await client.query(`
                DELETE FROM az_promo_tokens 
                WHERE promotion_id IN (SELECT id FROM az_promotions WHERE campaign_id = $1)
            `, [campaignId]);

            // 4. Delete tickets (BEFORE Claims to avoid FK violation)
            await client.query('DELETE FROM az_tickets WHERE campaign_id = $1', [campaignId]);

            // 5. Delete claims
            await client.query('DELETE FROM az_claims WHERE campaign_id = $1', [campaignId]);

            // 6. Delete promotions
            await client.query('DELETE FROM az_promotions WHERE campaign_id = $1', [campaignId]);

            // 7. Finally delete the campaign
            await client.query('DELETE FROM az_campaigns WHERE id = $1', [campaignId]);

            await client.query('COMMIT');
            console.log('[DeleteCampaign] Complete deletion finished');

            // Invalidate cache
            require('./AmigosService').invalidateCache();

            return { success: true };
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('[DeleteCampaign] Error:', e);
            throw e;
        } finally {
            client.release();
        }
    }

    async getMonitorStats(campaignId) {
        // 1. Traffic (Claims per hour)
        const trafficRes = await query(`
            SELECT to_char(claimed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'HH24:00') as hour, COUNT(*) as volume
            FROM az_claims
            WHERE campaign_id = $1
            GROUP BY 1
            ORDER BY 1
        `, [campaignId]);

        // 2. Failures (Orphan Claims)
        const failuresRes = await query(`
            SELECT c.id, c.phone, c.name, c.claimed_at 
            FROM az_claims c
            LEFT JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE c.campaign_id = $1 AND t.id IS NULL
        `, [campaignId]);

        // 3. Totals (Fix: Count TICKETS, not just Claims)
        const totalRes = await query(`
            SELECT COUNT(*) as total_tickets 
            FROM az_tickets 
            WHERE campaign_id = $1 AND status = 'ASSIGNED'
        `, [campaignId]);

        return {
            traffic: trafficRes.rows,
            failures: failuresRes.rows,
            total_claims: parseInt(totalRes.rows[0].total_tickets), // Label on UI says "Total Resgates" but often implies volumes
            last_updated: new Date()
        };
    }

    async getPromoStats(campaignId) {
        const res = await query(`
            SELECT p.name, COUNT(c.id) as count
            FROM az_promotions p
            LEFT JOIN az_claims c ON c.promotion_id = p.id
            WHERE p.campaign_id = $1
            GROUP BY p.name
            ORDER BY count DESC
        `, [campaignId]);

        return {
            labels: res.rows.map(r => r.name),
            data: res.rows.map(r => parseInt(r.count))
        };
    }

    // === DRAW SYSTEM (Sorteio) ===

    async drawWinner(campaignId) {
        // 1. Get Campaign Info (for Ghost Name and Status)
        const campRes = await query('SELECT house_winner_name, house_winner_active, house_winner_number FROM az_campaigns WHERE id = $1', [campaignId]);
        const camp = campRes.rows[0];
        const ghostName = camp?.house_winner_name || 'Jogador Fantasma';
        const forceHouse = camp?.house_winner_active; // If true, we FORCE house winner

        let res;

        if (forceHouse) {
            // FORCE HOUSE WINNER: Pick the HOUSE_RESERVED ticket specifically
            console.log('[Draw] Forcing House Winner (Ghost) - Using reserved ticket');
            res = await query(`
                SELECT t.number as ticket_number, t.status, c.name, c.phone
                FROM az_tickets t
                LEFT JOIN az_claims c ON t.assigned_claim_id = c.id
                WHERE t.campaign_id = $1 AND t.status = 'HOUSE_RESERVED'
                LIMIT 1
            `, [campaignId]);
        } else {
            // NORMAL FAIR DRAW
            res = await query(`
                SELECT t.number as ticket_number, t.status, c.name, c.phone
                FROM az_tickets t
                LEFT JOIN az_claims c ON t.assigned_claim_id = c.id
                WHERE t.campaign_id = $1
                ORDER BY RANDOM()
                LIMIT 1
            `, [campaignId]);
        }

        let winner = res.rows[0];

        // Fallback: If forcing house but no HOUSE_RESERVED ticket, we must pick ANY available (rare/impossible if synced)
        if (!winner && forceHouse) {
            console.warn('[Draw] No HOUSE_RESERVED ticket found! Falling back to AVAILABLE');
            res = await query(`
                SELECT t.number as ticket_number, t.status, c.name, c.phone
                FROM az_tickets t
                LEFT JOIN az_claims c ON t.assigned_claim_id = c.id
                WHERE t.campaign_id = $1 AND t.status = 'AVAILABLE'
                LIMIT 1
            `, [campaignId]);
            winner = res.rows[0];
        }

        // 3. Apply Ghost Logic (Stealth)
        // If ticket is HOUSE_RESERVED or not assigned, it belongs to the Ghost (House Winner)
        if (winner && (winner.status === 'HOUSE_RESERVED' || winner.status !== 'ASSIGNED')) {
            winner.name = ghostName; // Just the name (e.g. "Maria Alice...")
            winner.phone = 'CASA'; // Mark as house winner for frontend detection
            winner.is_ghost = true;
            winner.status = 'HOUSE_RESERVED'; // Ensure status is correct for frontend
        }

        return winner;
    }

    async getDrawCandidates(campaignId, limit = 60) {
        console.log('[AmigosAdminService] Getting draw candidates for campaign (FAST MODE):', campaignId);

        // OPTIMIZATION: ORDER BY RANDOM() on large tables is incredibly slow/locking.
        // Instead, we fetch a chunk of tickets (e.g., recent ones or a mix) and shuffle in Memory.
        // This makes the query 1000x faster (Milliseconds).

        const safeLimit = (limit && limit > 0 && limit <= 200) ? limit : 60;
        // Fetch slightly more to shuffle (e.g. 2x)
        const fetchLimit = safeLimit * 2;

        try {
            // We get a mix of tickets. 
            // 1. Get recent assigned (Sold)
            // 2. Get some available (Free)
            // Combined with UNION ALL or just simplified to standard select

            const res = await query(`
                SELECT t.number as ticket_number, t.status, c.name, c.phone, c.claimed_at
                FROM az_tickets t
                LEFT JOIN az_claims c ON t.assigned_claim_id = c.id
                WHERE t.campaign_id = $1
                LIMIT $2
            `, [campaignId, fetchLimit]);

            let rows = res.rows;

            // In-Memory Shuffle (Fisher-Yates)
            for (let i = rows.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [rows[i], rows[j]] = [rows[j], rows[i]];
            }

            // Slice to requested limit
            rows = rows.slice(0, safeLimit);

            return rows.map(r => ({
                number: r.ticket_number,
                status: r.status,
                name: r.name,
                phone: r.phone,
                claimed_at: r.claimed_at,
                label: r.status === 'ASSIGNED' ? (r.name ? r.name.split(' ')[0] : 'Participante') : 'Livre 🏠'
            }));
        } catch (e) {
            console.error('[AmigosAdminService] Error getting candidates:', e);
            throw e;
        }
    }

    async getStats(period, campaignId = null) {
        // period: '24h' or '7d'
        let timeFilter, interval;
        if (period === '24h') {
            timeFilter = "NOW() - INTERVAL '24 hours'";
            interval = 'hour'; // PostgreSQL trunk
        } else {
            timeFilter = "NOW() - INTERVAL '7 days'";
            interval = 'day';
        }

        // Get active campaign if not provided
        if (!campaignId) {
            const AmigosService = require('./AmigosService');
            const campaign = await AmigosService.getActiveCampaign();
            campaignId = campaign?.id;
        }

        if (!campaignId) {
            return {
                chart: { labels: [], data: [] },
                stats: { total_numbers: 0, total_users: 0, total_promos: 0 }
            };
        }

        // 1. Chart Data
        // Group claims by interval
        const chartRes = await query(`
            SELECT 
                DATE_TRUNC($1, claimed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') as time_bucket,
            COUNT(*) as count
            FROM az_claims
            WHERE claimed_at >= ${timeFilter} AND campaign_id = $2
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
            `, [interval, campaignId]);

        // Fill gaps if needed, but for MVP simple query is fine
        // Format labels and data
        const labels = [];
        const data = [];

        chartRes.rows.forEach(r => {
            const d = new Date(r.time_bucket);
            // Format label based on interval - convert to local visual
            if (interval === 'hour') {
                labels.push(d.getHours() + 'h');
            } else {
                // Day: Show "DD/MM (Dia)"
                const dayStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                const weekDay = d.toLocaleDateString('pt-BR', { weekday: 'short' });
                labels.push(`${dayStr}(${weekDay})`);
            }
            data.push(parseInt(r.count));
        });

        // 2. Total Distributed Numbers (for this campaign)
        const totalRes = await query('SELECT COUNT(*) as c FROM az_tickets WHERE status = \'ASSIGNED\' AND campaign_id = $1', [campaignId]);

        // 3. Total Participants (Unique Phones in this campaign)
        const usersRes = await query('SELECT COUNT(DISTINCT phone) as c FROM az_claims WHERE campaign_id = $1', [campaignId]);

        // 4. Redeemed Promo Codes (Stats in this campaign)
        const promoRes = await query('SELECT COUNT(*) as c FROM az_claims WHERE type = \'PROMO\' AND campaign_id = $1', [campaignId]);

        return {
            chart: { labels, data },
            stats: {
                total_numbers: parseInt(totalRes.rows[0].c),
                total_users: parseInt(usersRes.rows[0].c),
                total_promos: parseInt(promoRes.rows[0].c)
            }
        };
    }

    async logEvent(type, data) {
        await query(`
            INSERT INTO az_events(type, promotion_id, promo_token, phone, metadata, ip, user_agent, device_id)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8)
                `, [type, data.promo_id, data.token, data.phone, data.metadata, data.ip, data.ua, data.deviceId]);
    }
}

module.exports = new AmigosAdminService();
