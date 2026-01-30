const { default: makeWASocket, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const GroupMonitor = require('./groupMonitor');
const { usePostgresAuthState } = require('./authStore');

// Global state for QR code (accessible from admin panel)
global.botQR = null;
global.botStatus = 'disconnected'; // 'disconnected', 'qr_ready', 'connected'

async function connectToWhatsApp() {
    console.log('[Bot] Iniciando conexão...');

    // Use PostgreSQL-based auth state (persists across deploys!)
    const { state, saveCreds } = await usePostgresAuthState();


    // Create Socket
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Will print in Railway logs for scanning
        auth: state,
        browser: Browsers.macOS('Desktop'), // Defines how it appears on phone
        syncFullHistory: false // Otimiza startup
    });

    // Connection Logic
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('[Bot] QR Code gerado. Escaneie pelo painel admin ou logs.');
            global.botQR = qr;
            global.botStatus = 'qr_ready';
        }

        if (connection === 'close') {
            global.botStatus = 'disconnected';
            global.botQR = null;

            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[Bot] Conexão fechada: ${lastDisconnect?.error}. Reconectando: ${shouldReconnect}`);

            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 5000); // 5s delay
            } else {
                console.log('[Bot] Desconectado (Logout). Delete a pasta auth_info_baileys para gerar novo QR.');
            }
        } else if (connection === 'open') {
            console.log('[Bot] CONEXÃO ESTABELECIDA COM SUCESSO! 🤖✅');
            global.botStatus = 'connected';
            global.botQR = null;

            // Start Group Monitor
            try {
                const monitor = new GroupMonitor(sock);
                await monitor.start();
                global.groupMonitor = monitor;
            } catch (e) {
                console.error('[Bot] Error starting group monitor:', e.message);
            }
        }
    });

    // Save Creds
    sock.ev.on('creds.update', saveCreds);

    // Initial Message Handler (Skeleton)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    console.log('[Bot] Mensagem recebida de', msg.key.remoteJid);
                    // Import handler here later
                }
            }
        }
    });

    return sock;
}

module.exports = { connectToWhatsApp };
