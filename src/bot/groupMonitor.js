/**
 * Group Monitor - Listens to WhatsApp group events and validates members
 */
const { query } = require('../database/db');

/**
 * Normalize phone number for comparison - extracts last 9 digits
 * Handles: 5511999998888, 11999998888, (11) 99999-8888, +55 11 99999-8888
 */
function normalizePhone(phone) {
    if (!phone) return '';
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // Get last 9 digits (ignores country code and area code variations)
    return digits.slice(-9);
}

class GroupMonitor {
    constructor(sock) {
        this.sock = sock;
        this.monitoredGroups = new Set();
    }

    /**
     * Start monitoring all registered groups
     */
    async start() {
        console.log('[GroupMonitor] Starting group monitoring...');

        // Load registered groups from DB
        await this.loadMonitoredGroups();

        // Listen for participant updates
        this.sock.ev.on('group-participants.update', async (update) => {
            await this.handleParticipantUpdate(update);
        });

        // Listen for group updates (Link Revoke/Name Change)
        this.sock.ev.on('groups.update', async (updates) => {
            for (const update of updates) {
                console.log('[GroupMonitor] Group Update:', update);
                // If link was revoked or generic update, check link
                await this.checkAndUpdateLink(update.id);
            }
        });

        console.log('[GroupMonitor] Monitoring active for', this.monitoredGroups.size, 'groups');

        // Initial sync of links
        await this.syncGroupLinks();
    }

    /**
     * Load groups to monitor from database
     */
    async loadMonitoredGroups() {
        try {
            const result = await query('SELECT id, invite_link, whatsapp_id FROM whatsapp_groups WHERE active = true');

            for (const group of result.rows) {
                // We track primarily by current invite link to match new joins
                // But we also need the ID to map updates
                this.monitoredGroups.add(group.invite_link);
            }
        } catch (e) {
            console.error('[GroupMonitor] Error loading groups:', e.message);
        }
    }

    /**
     * Sync WhatsApp Group JIDs and Links with Database
     * Crucial for "Auto-Link Update" feature
     */
    async syncGroupLinks() {
        try {
            console.log('[GroupMonitor] Syncing group links...');
            const groups = await this.sock.groupFetchAllParticipating();
            const groupJids = Object.keys(groups);

            for (const jid of groupJids) {
                await this.checkAndUpdateLink(jid, groups[jid]);
            }
        } catch (e) {
            console.error('[GroupMonitor] Error syncing links:', e.message);
        }
    }

    /**
     * Check a specific group's link and update DB if needed
     */
    async checkAndUpdateLink(jid, groupMetadata = null) {
        try {
            // Get current code
            const code = await this.sock.groupInviteCode(jid);
            const currentLink = `https://chat.whatsapp.com/${code}`;

            // Try to find this group in DB
            // 1. By whatsapp_id (Best)
            let result = await query('SELECT * FROM whatsapp_groups WHERE whatsapp_id = $1', [jid]);
            let dbGroup = result.rows[0];

            if (!dbGroup) {
                // 2. Fallback: By invite_link (If not yet mapped)
                // We might have the OLD link in DB
                result = await query('SELECT * FROM whatsapp_groups WHERE invite_link = $1', [currentLink]);
                dbGroup = result.rows[0];

                if (!dbGroup) {
                    // Try to match by name? Risky but maybe needed if link changed AND we don't have ID
                    if (groupMetadata && groupMetadata.subject) {
                        const resName = await query('SELECT * FROM whatsapp_groups WHERE name = $1', [groupMetadata.subject]);
                        dbGroup = resName.rows[0];
                    }
                }
            }

            if (dbGroup) {
                const updates = [];
                const values = [];
                let idx = 1;

                // If we found it, ensure whatsapp_id is set
                if (dbGroup.whatsapp_id !== jid) {
                    updates.push(`whatsapp_id = $${idx++}`);
                    values.push(jid);
                    console.log(`[GroupMonitor] Mapping Group DB:${dbGroup.id} -> WA:${jid}`);
                }

                // If link changed
                if (dbGroup.invite_link !== currentLink) {
                    updates.push(`invite_link = $${idx++}`);
                    values.push(currentLink);
                    console.log(`[GroupMonitor] 🔄 Updating Link for Group ${dbGroup.id}: ${dbGroup.invite_link} -> ${currentLink}`);

                    // Update monitored set
                    this.monitoredGroups.delete(dbGroup.invite_link);
                    this.monitoredGroups.add(currentLink);
                }

                if (updates.length > 0) {
                    values.push(dbGroup.id);
                    await query(`UPDATE whatsapp_groups SET ${updates.join(', ')} WHERE id = $${idx}`, values);
                }
            }

        } catch (e) {
            // If we are not admin, we can't get the code. 
            // 401: Unauthorized
            if (e?.output?.statusCode !== 401) {
                console.error(`[GroupMonitor] Error checking link for ${jid}:`, e.message);
            }
        }
    }

    /**
     * Handle when someone joins/leaves a group
     */
    async handleParticipantUpdate(update) {
        const { id: groupId, participants, action } = update;

        console.log(`[GroupMonitor] Event: ${action} in group ${groupId}`);

        for (const participant of participants) {
            // Extract phone number (remove @s.whatsapp.net)
            const phone = participant.replace('@s.whatsapp.net', '');

            if (action === 'add') {
                await this.handleJoin(groupId, phone);
            } else if (action === 'remove') {
                await this.handleLeave(groupId, phone);
            }
        }
    }

    /**
     * Handle when someone joins a group
     */
    async handleJoin(groupId, phone) {
        try {
            // Check if this phone is registered in our system
            // We join via 'invite_link' usually.
            // But if we have mapped whatsapp_id, we can query by that too.
            // Simplified: Query leads assigned to groups that MATCH this WA info

            // First, find the DB group ID for this WA group
            const groupRes = await query('SELECT id FROM whatsapp_groups WHERE whatsapp_id = $1', [groupId]);

            let dbGroupId = null;
            if (groupRes.rows.length > 0) {
                dbGroupId = groupRes.rows[0].id;
            }

            // If we don't know the group via ID, we might have issues if link changed.
            // But 'GroupHubService.joinHub' assigns `assigned_group_id`.

            let queryStr = 'SELECT l.* FROM leads l WHERE l.phone = $1';
            let params = [phone];

            if (dbGroupId) {
                // More specific: User must be assigned to THIS group
                queryStr += ' AND l.assigned_group_id = $2';
                params.push(dbGroupId);
            }

            const result = await query(queryStr, params);

            if (result.rows.length === 0) {
                console.log(`[GroupMonitor] ⚠️ UNREGISTERED user joined: ${phone}`);
                return;
            }

            const lead = result.rows[0];

            // Update lead status to confirmed
            await query(
                `UPDATE leads SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`,
                [lead.id]
            );

            console.log(`[GroupMonitor] ✅ Registered user confirmed: ${phone} (${lead.name})`);

        } catch (e) {
            console.error('[GroupMonitor] Error handling join:', e.message);
        }
    }

    /**
     * Handle when someone leaves a group
     */
    async handleLeave(groupId, phone) {
        try {
            // Mark lead as LEFT
            await query(
                `UPDATE leads SET status = 'LEFT', updated_at = NOW() WHERE phone = $1`,
                [phone]
            );

            console.log(`[GroupMonitor] User left: ${phone}`);

        } catch (e) {
            console.error('[GroupMonitor] Error handling leave:', e.message);
        }
    }

    /**
     * Get all participants from a WhatsApp group
     */
    async getGroupParticipants(groupId) {
        try {
            const metadata = await this.sock.groupMetadata(groupId);
            return metadata.participants.map(p => p.id.replace('@s.whatsapp.net', ''));
        } catch (e) {
            console.error('[GroupMonitor] Error getting participants:', e.message);
            return [];
        }
    }

    /**
     * FULL SYNC: Map all groups and validate members against database
     * OPTIMIZED: Uses batch SQL operations instead of per-member queries
     */
    async syncAllMembers() {
        console.log('[GroupMonitor] 🔄 Starting OPTIMIZED sync of all groups and members...');
        const startTime = Date.now();

        const results = {
            groups_synced: 0,
            total_wa_members: 0,
            leads_updated: 0,
            unregistered_count: 0,
            missing_from_groups: 0,
            errors: []
        };

        try {
            // Step 1: Get ALL groups the bot is participating in
            const groups = await this.sock.groupFetchAllParticipating();
            const groupJids = Object.keys(groups);
            console.log(`[GroupMonitor] Found ${groupJids.length} groups`);

            // Collect all participants per group
            const groupMappings = []; // {jid, link, participants, dbGroupId}

            // Step 2: Map groups to database (fast - only a few groups)
            for (const jid of groupJids) {
                const groupMeta = groups[jid];
                console.log(`[GroupMonitor] Processing group: ${groupMeta.subject}`);

                try {
                    const code = await this.sock.groupInviteCode(jid);
                    const currentLink = `https://chat.whatsapp.com/${code}`;

                    // Find group in database
                    let dbGroupRes = await query(
                        'SELECT * FROM whatsapp_groups WHERE whatsapp_id = $1 OR invite_link = $2',
                        [jid, currentLink]
                    );
                    let dbGroup = dbGroupRes.rows[0];

                    if (!dbGroup) {
                        const nameRes = await query(
                            'SELECT * FROM whatsapp_groups WHERE LOWER(name) LIKE LOWER($1)',
                            [`%${groupMeta.subject}%`]
                        );
                        dbGroup = nameRes.rows[0];
                    }

                    if (dbGroup) {
                        // Update group mapping
                        await query(
                            `UPDATE whatsapp_groups 
                             SET whatsapp_id = $1, invite_link = $2, name = COALESCE(name, $3)
                             WHERE id = $4`,
                            [jid, currentLink, groupMeta.subject, dbGroup.id]
                        );

                        const participants = groupMeta.participants.map(p =>
                            p.id.replace('@s.whatsapp.net', '')
                        );

                        // Update real count in DB
                        await query(
                            'UPDATE whatsapp_groups SET current_count = $1 WHERE id = $2',
                            [participants.length, dbGroup.id]
                        );

                        groupMappings.push({
                            jid,
                            dbGroupId: dbGroup.id,
                            participants
                        });

                        results.total_wa_members += participants.length;
                        results.groups_synced++;
                        console.log(`[GroupMonitor] ✅ Mapped: ${groupMeta.subject} (${participants.length} members)`);
                    }
                } catch (e) {
                    results.errors.push({ group: jid, error: e.message });
                }
            }

            // Step 3: BATCH UPDATE - Update assigned_group_id for all members in each group
            // Uses RIGHT() to compare last 9 digits - handles different phone formats
            for (const mapping of groupMappings) {
                if (mapping.participants.length === 0) continue;

                // Normalize phones to last 9 digits for comparison
                const normalizedPhones = mapping.participants.map(p => normalizePhone(p));

                // Batch update using last 9 digits match
                const updateResult = await query(
                    `UPDATE leads 
                     SET assigned_group_id = $1, status = 'ACTIVE', updated_at = NOW() 
                     WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = ANY($2::text[]) 
                       AND (assigned_group_id != $1 OR status != 'ACTIVE')
                     RETURNING id`,
                    [mapping.dbGroupId, normalizedPhones]
                );
                results.leads_updated += updateResult.rowCount;

                // Count registered phones (matching last 9 digits)
                const registeredRes = await query(
                    `SELECT phone FROM leads 
                     WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = ANY($1::text[])`,
                    [normalizedPhones]
                );
                results.unregistered_count += mapping.participants.length - registeredRes.rows.length;
            }

            // Step 4: BATCH - Mark leads as LEFT if not in any group (using normalized comparison)
            const allNormalizedPhones = groupMappings.flatMap(m =>
                m.participants.map(p => normalizePhone(p))
            );
            if (allNormalizedPhones.length > 0) {
                const leftResult = await query(
                    `UPDATE leads 
                     SET status = 'LEFT', updated_at = NOW() 
                     WHERE status = 'ACTIVE' 
                       AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) != ALL($1::text[])
                     RETURNING id`,
                    [allNormalizedPhones]
                );
                results.missing_from_groups = leftResult.rowCount;
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[GroupMonitor] ✅ SYNC COMPLETE in ${duration}s!`);
            console.log(`  Groups: ${results.groups_synced}`);
            console.log(`  WA Members: ${results.total_wa_members}`);
            console.log(`  Leads updated: ${results.leads_updated}`);
            console.log(`  Unregistered: ${results.unregistered_count}`);
            console.log(`  Marked LEFT: ${results.missing_from_groups}`);

            results.duration_seconds = parseFloat(duration);

        } catch (e) {
            console.error('[GroupMonitor] SYNC ERROR:', e.message);
            results.errors.push({ error: e.message });
        }

        return results;
    }

    /**
     * Sync single group members (legacy method, kept for compatibility)
     */
    async syncGroupMembers(groupId) {
        try {
            const participants = await this.getGroupParticipants(groupId);
            return { participants: participants.length, unregistered: [] };
        } catch (e) {
            return { participants: 0, unregistered: [], error: e.message };
        }
    }
}

module.exports = GroupMonitor;
