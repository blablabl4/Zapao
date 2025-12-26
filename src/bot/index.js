const { connectToWhatsApp } = require('./connection');

async function startBot() {
    console.log('[Bot] Inicializando módulo WhatsApp...');
    try {
        const sock = await connectToWhatsApp();

        // Global access for other modules if needed
        global.whatsappSocket = sock;

        return sock;
    } catch (error) {
        console.error('[Bot] Falha fatal ao iniciar:', error);
    }
}

module.exports = { startBot };
