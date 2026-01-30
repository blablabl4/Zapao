/**
 * PostgreSQL-based Auth State for Baileys
 * Replaces useMultiFileAuthState with database persistence
 */
const { query } = require('../database/db');
const baileys = require('@whiskeysockets/baileys');

// Handle different export styles across Baileys versions
const proto = baileys.proto || baileys.default?.proto;
const initAuthCreds = baileys.initAuthCreds || baileys.default?.initAuthCreds || (() => {
    // Fallback: create basic creds structure
    const { randomBytes } = require('crypto');
    return {
        noiseKey: { private: randomBytes(32), public: randomBytes(32) },
        signedIdentityKey: { private: randomBytes(32), public: randomBytes(32) },
        signedPreKey: { keyPair: { private: randomBytes(32), public: randomBytes(32) }, signature: randomBytes(64), keyId: 1 },
        registrationId: Math.floor(Math.random() * 16383) + 1,
        advSecretKey: randomBytes(32).toString('base64'),
        me: undefined,
        account: undefined,
        signalIdentities: [],
        platform: undefined,
        lastAccountSyncTimestamp: 0,
        myAppStateKeyId: undefined
    };
});

/**
 * Custom auth state that stores in PostgreSQL
 * @returns {Promise<{state: AuthenticationState, saveCreds: () => Promise<void>}>}
 */
async function usePostgresAuthState() {
    console.log('[AuthStore] Initializing PostgreSQL auth state...');

    // Helper to read from DB
    const readData = async (key) => {
        try {
            const result = await query('SELECT data FROM bot_auth WHERE key = $1', [key]);
            if (result.rows.length > 0) {
                return result.rows[0].data;
            }
            return null;
        } catch (e) {
            console.error(`[AuthStore] Error reading ${key}:`, e.message);
            return null;
        }
    };

    // Helper to write to DB
    const writeData = async (key, data) => {
        try {
            await query(
                `INSERT INTO bot_auth (key, data, updated_at) 
                 VALUES ($1, $2, NOW()) 
                 ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW()`,
                [key, JSON.stringify(data)]
            );
        } catch (e) {
            console.error(`[AuthStore] Error writing ${key}:`, e.message);
        }
    };

    // Helper to remove from DB
    const removeData = async (key) => {
        try {
            await query('DELETE FROM bot_auth WHERE key = $1', [key]);
        } catch (e) {
            console.error(`[AuthStore] Error removing ${key}:`, e.message);
        }
    };

    // Load or create credentials
    let creds = await readData('creds');
    if (creds) {
        console.log('[AuthStore] ✅ Loaded existing credentials from database');
        // Parse the stored JSON back to proper format
        if (typeof creds === 'string') {
            creds = JSON.parse(creds);
        }
    } else {
        console.log('[AuthStore] 🆕 No credentials found, generating new...');
        creds = initAuthCreds();
    }

    // Auth state object
    const state = {
        creds,
        keys: {
            get: async (type, ids) => {
                const data = {};
                for (const id of ids) {
                    const key = `${type}-${id}`;
                    let value = await readData(key);
                    if (value) {
                        if (typeof value === 'string') {
                            value = JSON.parse(value);
                        }
                        if (type === 'app-state-sync-key') {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                }
                return data;
            },
            set: async (data) => {
                for (const category in data) {
                    for (const id in data[category]) {
                        const value = data[category][id];
                        const key = `${category}-${id}`;
                        if (value) {
                            await writeData(key, value);
                        } else {
                            await removeData(key);
                        }
                    }
                }
            }
        }
    };

    // Save credentials function
    const saveCreds = async () => {
        await writeData('creds', state.creds);
        console.log('[AuthStore] 💾 Credentials saved to database');
    };

    return { state, saveCreds };
}

module.exports = { usePostgresAuthState };
