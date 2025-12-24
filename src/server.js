const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { initializeDatabase, closeDatabase, getPool } = require('./database/db');
const expirationJob = require('./jobs/expirationJob');
const drawExpirationJob = require('./jobs/drawExpirationJob');
const { requireAdmin } = require('./middleware/adminAuth');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    store: new pgSession({
        pool: getPool(),
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'tvzapao-super-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Admin authentication routes (unprotected)
app.use('/admin', require('./routes/adminAuth'));

// Protected admin API routes
app.use('/api/admin', requireAdmin, require('./routes/admin'));

// Admin panel page (protected)
app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile('admin.html', { root: path.join(__dirname, '../public') });
});

// Amigos do Zapão page
app.get('/amigos-do-zapao', (req, res) => {
    res.sendFile('amigos-do-zapao.html', { root: path.join(__dirname, '../public') });
});

// Public routes
app.use('/api/orders', require('./routes/orders'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/history', require('./routes/history'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Initialize and start server
async function startServer() {
    try {
        // Initialize database
        await initializeDatabase();

        // Start background jobs
        expirationJob.start();
        drawExpirationJob.start();

        // Start HTTP server
        const server = app.listen(PORT, () => {
            console.log(`\n🎰 TVZapão Server running on http://localhost:${PORT}`);
            console.log(`📊 Admin panel: http://localhost:${PORT}/admin`);
            console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('\n[Server] SIGTERM received, shutting down gracefully...');

            expirationJob.stop();
            drawExpirationJob.stop();

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
