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
// Block direct access to admin HTML files - redirect to protected routes
app.use((req, res, next) => {
    const adminHtmlFiles = ['/admin-zapao.html', '/admin-amigos.html', '/admin-hub.html'];
    if (adminHtmlFiles.includes(req.path)) {
        // Redirect to protected route (without .html)
        const protectedPath = req.path.replace('.html', '');
        return res.redirect(protectedPath);
    }
    next();
});
// Static files (disabled cache for updates)
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: '0',
    etag: false
}));

// Serve uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Admin authentication routes (unprotected)
app.use('/admin', require('./routes/adminAuth'));

// Admin Panel - Hub
app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile('admin-hub.html', { root: 'public' });
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

// Zapão da Sorte (Path: /zapao-da-sorte)
app.get('/zapao-da-sorte', (req, res) => {
    res.sendFile('zapao-da-sorte.html', { root: path.join(__dirname, '../public') });
});

// Root Redirect (Optional: Send to Zapão)
app.get('/', (req, res) => {
    res.redirect('/zapao-da-sorte');
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
// BOLÃO ROUTES REMOVED (Project Archived)
app.use('/api/admin/amigos', requireAdmin, require('./routes/adminAmigos'));

// Admin Zapão (Protected)
app.get('/admin-zapao', requireAdmin, (req, res) => {
    res.sendFile('admin-zapao.html', { root: path.join(__dirname, '../public') });
});


// Zapão Routes
app.use('/api/orders', require('./routes/orders'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/history', require('./routes/history'));

// Admin Zapão API Routes (stats, payments, winners, draw management)
app.use('/api/admin', requireAdmin, require('./routes/admin'));

// Public winners endpoint (for popup - no auth needed)
app.get('/api/public/winners', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const { query } = require('./database/db');
        const result = await query(`
            SELECT o.buyer_ref, d.draw_name, d.closed_at
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            WHERE o.status = 'PAID' 
              AND o.number = d.drawn_number
              AND d.status = 'CLOSED'
            ORDER BY d.closed_at DESC
            LIMIT $1
        `, [limit]);

        const winners = result.rows.map(row => {
            const parts = row.buyer_ref ? row.buyer_ref.split('|') : [];
            return {
                name: parts[0] || 'Ganhador',
                bairro: parts[3] || '',
                cidade: parts[4] || ''
            };
        });

        res.json({ winners });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao buscar ganhadores' });
    }
});

// Public Draws List (Accordion)
app.get('/api/public/draws', async (req, res) => {
    try {
        const DrawService = require('./services/DrawService');
        const draws = await DrawService.getPublicDraws();
        res.json({ draws });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao buscar rifas' });
    }
});

// Public draw endpoint (for timer and prize display)
app.get('/api/public/draw', async (req, res) => {
    try {
        const DrawService = require('./services/DrawService');
        const currentDraw = await DrawService.getCurrentDraw();

        res.json({ current_draw: currentDraw });
    } catch (error) {
        console.error('[Public API] Error getting draw:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.use('/api/admin', requireAdmin, require('./routes/admin')); // Zapão admin routes

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

        // Temporary fix for legacy orders (mixed PAID/EXPIRED)
        app.get('/api/public/fix-legacy', async (req, res) => {
            try {
                const { query } = require('./database/db');

                // Find distinct buyer_refs that have at least one PAID order
                // And update all other orders with same buyer_ref and created within 1 min to PAID
                const result = await query(`
            WITH PaidOrders AS (
                SELECT DISTINCT buyer_ref, created_at 
                FROM orders 
                WHERE status = 'PAID'
            )
            UPDATE orders o
            SET status = 'PAID'
            FROM PaidOrders p
            WHERE o.buyer_ref = p.buyer_ref 
              AND o.status IN ('PENDING', 'EXPIRED')
              AND o.created_at > p.created_at - interval '2 minutes'
              AND o.created_at < p.created_at + interval '2 minutes'
            RETURNING o.order_id, o.buyer_ref
        `);

                res.json({
                    success: true,
                    fixed_count: result.rowCount,
                    fixed_orders: result.rows
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Temporary fix for Draw 3
        app.get('/api/public/fix-draw-3', async (req, res) => {
            try {
                const { query } = require('./database/db');
                await query(`
                    UPDATE draws 
                    SET drawn_number = 47,
                        winners_count = 2,
                        payout_each = (prize_base + reserve_amount) / 2
                    WHERE id = 3
                `);
                res.json({ success: true, message: 'Draw 3 fixed to #47 with 2 winners' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

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
