const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

async function connectToWhatsApp() {
    console.log('[Bot] Iniciando conexão...');

    // Ensure auth folder exists
    const authPath = path.join(__dirname, 'auth_info_baileys');
    if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    // Create Socket
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Will print in Railway logs for scanning
        auth: state,
        browser: Browsers.macOS('Desktop'), // Defines how it appears on phone
        syncFullHistory: false // Otimiza startup
    });

    // Connection Logic
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('[Bot] QR Code gerado.');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[Bot] Conexão fechada: ${lastDisconnect?.error}. Reconectando: ${shouldReconnect}`);

            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 5000); // 5s delay
            } else {
                console.log('[Bot] Desconectado (Logout). Delete a pasta auth_info_baileys para gerar novo QR.');
            }
        } else if (connection === 'open') {
            console.log('[Bot] CONEXÃO ESTABELECIDA COM SUCESSO! 🤖✅');
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
