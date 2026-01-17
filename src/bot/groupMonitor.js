/**
 * Group Monitor - Listens to WhatsApp group events and validates members
 */
const { query } = require('../database/db');

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

        console.log('[GroupMonitor] Monitoring active for', this.monitoredGroups.size, 'groups');
    }

    /**
     * Load groups to monitor from database
     */
    async loadMonitoredGroups() {
        try {
            const result = await query('SELECT id, invite_link FROM whatsapp_groups WHERE active = true');

            for (const group of result.rows) {
                // Extract group ID from invite link if possible, or store link as identifier
                this.monitoredGroups.add(group.invite_link);
            }
        } catch (e) {
            console.error('[GroupMonitor] Error loading groups:', e.message);
        }
    }

    /**
     * Handle when someone joins/leaves a group
     */
    async handleParticipantUpdate(update) {
        const { id: groupId, participants, action } = update;

        console.log(`[GroupMonitor] Event: ${action} in group ${groupId}`);
        console.log(`[GroupMonitor] Participants:`, participants);

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
            const result = await query(
                'SELECT l.*, g.invite_link FROM leads l JOIN whatsapp_groups g ON l.assigned_group_id = g.id WHERE l.phone = $1',
                [phone]
            );

            if (result.rows.length === 0) {
                // User not registered - log warning (could kick in future)
                console.log(`[GroupMonitor] ⚠️ UNREGISTERED user joined: ${phone}`);

                // Option: Send warning message or kick
                // await this.sock.groupParticipantsUpdate(groupId, [phone + '@s.whatsapp.net'], 'remove');

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

            // Decrease group count
            // Note: We'd need to map groupId to our DB group, which requires storing WhatsApp group IDs

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
     * Sync database with actual group participants (periodic task)
     */
    async syncGroupMembers(groupId) {
        console.log('[GroupMonitor] Syncing members for group:', groupId);

        const participants = await this.getGroupParticipants(groupId);

        // Get registered leads for this group
        const result = await query(
            `SELECT l.phone FROM leads l 
             JOIN whatsapp_groups g ON l.assigned_group_id = g.id 
             WHERE l.status = 'ACTIVE'`
        );

        const registeredPhones = new Set(result.rows.map(r => r.phone));

        // Find unregistered members
        const unregistered = participants.filter(p => !registeredPhones.has(p));

        console.log(`[GroupMonitor] Sync complete. Unregistered users: ${unregistered.length}`);

        return { participants: participants.length, unregistered };
    }
}

module.exports = GroupMonitor;
