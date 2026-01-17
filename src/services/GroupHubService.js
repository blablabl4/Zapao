const { query, getClient } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class GroupHubService {
    /**
     * Assign a user to a group or retrieve their existing assignment.
     * @param {Object} userData - { name, phone, referrerToken }
     * @returns {Object} - { group, lead, isNew }
     */
    static async joinHub(userData) {
        const { name, phone, referrerToken } = userData;

        // Clean phone number (remove non-digits)
        const cleanPhone = phone.replace(/\D/g, '');

        const client = await getClient();

        try {
            await client.query('BEGIN');

            // 1. Check if user already exists
            const resLead = await client.query(
                `SELECT l.*, g.invite_link, g.name as group_name 
                 FROM leads l
                 JOIN whatsapp_groups g ON l.assigned_group_id = g.id
                 WHERE l.phone = $1`,
                [cleanPhone]
            );

            if (resLead.rows.length > 0) {
                // User exists, return their group
                await client.query('COMMIT');
                return {
                    lead: resLead.rows[0],
                    group_link: resLead.rows[0].invite_link,
                    isNew: false
                };
            }

            // 2. Resolve referrer (if any)
            let referrerId = null;
            if (referrerToken) {
                const resRef = await client.query(
                    'SELECT id FROM leads WHERE affiliate_token = $1',
                    [referrerToken]
                );
                if (resRef.rows.length > 0) {
                    referrerId = resRef.rows[0].id;
                }
            }

            // 3. Find available group (Active and not full)
            // Strategy: Fill groups sequentially by ID
            const resGroup = await client.query(
                `SELECT id, invite_link, name, current_count, capacity 
                 FROM whatsapp_groups 
                 WHERE active = true AND current_count < capacity
                 ORDER BY id ASC
                 LIMIT 1`
            );

            if (resGroup.rows.length === 0) {
                throw new Error('Nenhum grupo disponível no momento.');
            }

            const targetGroup = resGroup.rows[0];

            // 4. Create Lead
            const newToken = uuidv4().split('-')[0]; // Short token
            const resNewLead = await client.query(
                `INSERT INTO leads (name, phone, assigned_group_id, affiliate_token, referrer_id)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [name, cleanPhone, targetGroup.id, newToken, referrerId]
            );

            // 5. Increment Group Count
            await client.query(
                `UPDATE whatsapp_groups SET current_count = current_count + 1 WHERE id = $1`,
                [targetGroup.id]
            );

            await client.query('COMMIT');

            return {
                lead: resNewLead.rows[0],
                group_link: targetGroup.invite_link,
                isNew: true
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get current active banner/campaign info from database
     */
    static async getConfig() {
        try {
            const result = await query(`SELECT key, value FROM hub_config`);
            const config = {
                active: true,
                banner_url: null,
                title: 'Entre para o Grupo VIP',
                description: 'Receba ofertas exclusivas e participe de sorteios!'
            };

            for (const row of result.rows) {
                if (row.key === 'banner_url') config.banner_url = row.value;
                if (row.key === 'title') config.title = row.value;
                if (row.key === 'active') config.active = row.value === 'true';
            }

            return config;
        } catch (e) {
            // If table doesn't exist, return defaults
            return {
                active: true,
                banner_url: null,
                title: 'Entre para o Grupo VIP',
                description: 'Receba ofertas exclusivas e participe de sorteios!'
            };
        }
    }

    /**
     * Get user info by token (for affiliate dashboard)
     */
    static async getLeadByToken(token) {
        const res = await query(
            `SELECT l.*, g.name as group_name, 
             (SELECT COUNT(*) FROM leads WHERE referrer_id = l.id) as referral_count
             FROM leads l
             LEFT JOIN whatsapp_groups g ON l.assigned_group_id = g.id
             WHERE l.affiliate_token = $1`,
            [token]
        );
        return res.rows[0];
    }

    /**
     * Create a new group (Admin)
     */
    static async createGroup(name, link, capacity = 250) {
        const res = await query(
            `INSERT INTO whatsapp_groups (name, invite_link, capacity) 
             VALUES ($1, $2, $3) RETURNING *`,
            [name, link, capacity]
        );
        return res.rows[0];
    }

    /**
     * Validate users against CSV data
     * @param {Array} csvRecords - Array of { phone, group_link }
     */
    static async validateLeads(csvRecords) {
        // Implementation for CSV validation logic
        // 1. Mark all leads as temporarily 'UNVERIFIED' or just compare
        // This is complex, will implement basic version first

        const report = {
            processed: 0,
            duplicates: [],
            notFoundInCsv: [],
            disabledLinks: 0
        };

        // Normalize CSV phones
        const csvMap = new Map(); // phone -> count
        const csvGroups = new Map(); // phone -> [groups]

        for (const row of csvRecords) {
            const p = row.phone.replace(/\D/g, '');
            if (!p) continue;

            if (!csvMap.has(p)) {
                csvMap.set(p, 1);
                csvGroups.set(p, [row.group_link]);
            } else {
                csvMap.set(p, csvMap.get(p) + 1);
                csvGroups.get(p).push(row.group_link);
            }
        }

        // Detect duplicates in CSV (User in multiple groups)
        for (const [phone, count] of csvMap.entries()) {
            if (count > 1) {
                report.duplicates.push({ phone, groups: csvGroups.get(phone) });
            }
        }

        // Logic to disable links for users NOT in CSV
        // Get all active leads
        const allLeads = await query(`SELECT id, phone, status FROM leads WHERE status = 'ACTIVE'`);

        for (const lead of allLeads.rows) {
            if (!csvMap.has(lead.phone)) {
                // User not in CSV -> Disable
                await query(`UPDATE leads SET status = 'LEFT' WHERE id = $1`, [lead.id]);
                // Decrease group count? Maybe.
                report.notFoundInCsv.push(lead.phone);
                report.disabledLinks++;
            }
        }

        return report;
    }
}

module.exports = GroupHubService;
