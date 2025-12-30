/**
 * Centralized Configuration
 * All environment variables and config in one place
 */
require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = [
    'DATABASE_URL',
    'SESSION_SECRET'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error('❌ ERRO: Variáveis de ambiente obrigatórias faltando:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
}

module.exports = {
    // Server
    PORT: parseInt(process.env.PORT, 10) || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Database
    DATABASE_URL: process.env.DATABASE_URL,

    // Session
    SESSION_SECRET: process.env.SESSION_SECRET,
    SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours

    // Security
    // Relaxed for High Traffic Events
    RATE_LIMIT_WINDOW_MS: 1 * 60 * 1000, // 1 minute (faster recovery)
    RATE_LIMIT_MAX_REQUESTS: 1000, // High capacity for shared IPs/CGNAT
    RATE_LIMIT_LOGIN_MAX: 10, // Slightly increased login tolerance

    // CORS
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://www.tvzapao.com.br',

    // Cloudinary (optional)
    CLOUDINARY: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
        isConfigured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
    },

    // Feature flags
    IS_PRODUCTION: process.env.NODE_ENV === 'production'
};
