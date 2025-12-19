const { Pool } = require('pg');

let pool = null;

/**
 * Get or create PostgreSQL connection pool
 */
function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20, // Maximum pool size
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });

        pool.on('error', (err) => {
            console.error('[DB Pool] Unexpected error:', err);
        });

        console.log('[DB] PostgreSQL pool initialized');
    }

    return pool;
}

/**
 * Get database instance (for query execution)
 */
function getDatabase() {
    return getPool();
}

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 */
async function query(text, params) {
    const pool = getPool();
    return pool.query(text, params);
}

/**
 * Get a client from the pool (for transactions)
 */
async function getClient() {
    const pool = getPool();
    return pool.connect();
}

/**
 * Initialize database (run migrations)
 */
async function initializeDatabase() {
    console.log('[DB] Initializing database...');

    try {
        // Test connection
        const pool = getPool();
        const result = await pool.query('SELECT NOW()');
        console.log('[DB] Connection successful:', result.rows[0].now);

        // Run migrations
        const path = require('path');
        const { runMigrations } = require(path.join(__dirname, '../../migrations/migrate'));
        await runMigrations();

        console.log('[DB] Database initialized successfully');
    } catch (error) {
        console.error('[DB] Initialization failed:', error.message);
        throw error;
    }
}

/**
 * Close database connection (graceful shutdown)
 */
async function closeDatabase() {
    if (pool) {
        await pool.end();
        console.log('[DB] Connection pool closed');
    }
}

module.exports = {
    getDatabase,
    getPool,
    query,
    getClient,
    initializeDatabase,
    closeDatabase
};
