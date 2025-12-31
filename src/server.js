const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Internal modules
const config = require('./config');
const { initializeDatabase, closeDatabase, getPool } = require('./database/db');
const expirationJob = require('./jobs/expirationJob');
const drawExpirationJob = require('./jobs/drawExpirationJob');
const paymentPollingJob = require('./jobs/paymentPollingJob');
const ticketCleanupJob = require('./jobs/ticketCleanupJob');
const { requireAdmin } = require('./middleware/adminAuth');

const app = express();

// Trust proxy (required for secure cookies on Railway/Cloud providers)
app.set('trust proxy', 1);

// === SECURITY MIDDLEWARE ===
// Helmet - Secure HTTP headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for inline scripts in HTML
    crossOriginEmbedderPolicy: false
}));

// CORS - Only allow our domain
app.use(cors({
    origin: config.IS_PRODUCTION
        ? ['https://www.tvzapao.com.br', 'https://tvzapao.com.br']
        : true, // Allow all in development
    credentials: true
}));

// Rate limiting - General API
const apiLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Rate limiting - Stricter for sensitive routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: config.RATE_LIMIT_LOGIN_MAX,
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});
app.use('/admin/login', authLimiter);
app.use('/admin/authenticate', authLimiter);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    store: new pgSession({
        pool: getPool(),
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: config.SESSION_SECRET, // Now required via config
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.IS_PRODUCTION,
        httpOnly: true,
        maxAge: config.SESSION_MAX_AGE
    }
}));

// Static files
// Static files (disabled cache for updates)
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: '0',
    etag: false
}));

// Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Admin authentication routes (unprotected)
app.use('/admin', require('./routes/adminAuth'));

// Admin Panel - redirect to Amigos Admin
app.get('/admin', requireAdmin, (req, res) => {
    res.redirect('/admin/amigos');
});

// ARCHIVED: admin-hub, admin-luck routes removed (not in use)

// Dynamic Share Route for Promotions (OG Tags injection)
app.get('/p/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const { query } = require('./database/db');
        const pRes = await query(`
            SELECT p.* FROM az_promo_tokens t
            JOIN az_promotions p ON t.promotion_id = p.id
            WHERE t.token = $1
        `, [token]);

        let ogImage = null;
        let ogTitle = 'Amigos do Zapão';
        let ogDesc = 'Resgate seu número da sorte diário gratuitamente!';

        if (pRes.rows.length > 0) {
            const p = pRes.rows[0];
            if (p.image_url) ogImage = p.image_url.startsWith('http') ? p.image_url : `https://www.tvzapao.com.br${p.image_url}`;
            ogTitle = p.name || ogTitle;
            if (p.share_text) ogDesc = p.share_text;
        }

        const fs = require('fs');
        const filePath = path.join(__dirname, '../public/amigos-do-zapao.html');
        let html = fs.readFileSync(filePath, 'utf8');

        // Construct Meta Tags conditionally
        let metaTags = `
            <meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
            <meta property="og:description" content="${ogDesc.replace(/"/g, '&quot;')}" />
        `;

        if (ogImage) {
            metaTags += `
            <meta property="og:image" content="${ogImage}" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta name="twitter:card" content="summary_large_image" />
            `;
        } else {
            metaTags += `<meta name="twitter:card" content="summary" />`;
        }

        // Replace head or append
        html = html.replace('</head>', `${metaTags}\n</head>`);

        res.send(html);
    } catch (e) {
        console.error('Error serving promo link:', e);
        res.redirect('/amigos-do-zapao');
    }
});

// Root redirect to main app
app.get('/', (req, res) => {
    res.redirect('/amigos-do-zapao');
});

// Amigos do Zapão page
app.get('/amigos-do-zapao', (req, res) => {
    res.sendFile('amigos-do-zapao.html', { root: path.join(__dirname, '../public') });
});

// Admin Amigos Manager
app.get('/admin/amigos', requireAdmin, (req, res) => {
    res.sendFile('admin-amigos.html', { root: path.join(__dirname, '../public') });
});

// === ACTIVE API ROUTES ===
app.use('/api/amigos', require('./routes/amigos'));
app.use('/api/bolao', require('./routes/bolao'));
app.use('/api/bolao', require('./routes/bolaoValidation')); // Participant validation
app.use('/api/admin/amigos', requireAdmin, require('./routes/adminAmigos'));
app.use('/api/admin/bolao', requireAdmin, require('./routes/adminBolao'));

// Admin Bolão Manager
app.get('/admin/bolao', requireAdmin, (req, res) => {
    res.sendFile('admin-bolao.html', { root: path.join(__dirname, '../public') });
});

// Bolão Frontend
app.get('/bolao', (req, res) => {
    res.sendFile('bolao.html', { root: path.join(__dirname, '../public') });
});

// Bolão Validation Page (public)
app.get('/validar', (req, res) => {
    res.sendFile('validar.html', { root: path.join(__dirname, '../public') });
});


// ARCHIVED: orders, webhooks, history routes removed (not in use)

// Health check endpoints (/health, /health/detailed, /health/ready, /health/live)
app.use('/health', require('./routes/health'));

// === ERROR HANDLING ===
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
app.use(notFoundHandler); // 404 for unmatched routes
app.use(errorHandler);    // Centralized error handler

// Initialize and start server
async function startServer() {
    try {
        // Initialize database
        await initializeDatabase();

        // Start background jobs
        expirationJob.start();
        drawExpirationJob.start();
        paymentPollingJob.start();
        ticketCleanupJob.start();

        // Start WhatsApp Bot (Bot Phase 9) - PAUSED
        // const { startBot } = require('./bot');
        // startBot();

        // Start HTTP server
        const server = app.listen(config.PORT, () => {
            console.log(`\n🎰 TVZapão Server running on http://localhost:${config.PORT}`);
            console.log(`📊 Admin panel: http://localhost:${config.PORT}/admin`);
            console.log(`💚 Health check: http://localhost:${config.PORT}/health\n`);
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('\n[Server] SIGTERM received, shutting down gracefully...');

            expirationJob.stop();
            drawExpirationJob.stop();
            paymentPollingJob.stop();
            ticketCleanupJob.stop();

            server.close(async () => {
                await closeDatabase();
                console.log('[Server] Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', async () => {
            console.log('\n[Server] SIGINT received, shutting down gracefully...');

            expirationJob.stop();
            drawExpirationJob.stop();
            paymentPollingJob.stop();
            ticketCleanupJob.stop();

            server.close(async () => {
                await closeDatabase();
                console.log('[Server] Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('[Server] Failed to start:', error.message);
        process.exit(1);
    }
}

startServer();
