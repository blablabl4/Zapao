/**
 * Health Check Routes
 * Provides detailed health status for monitoring
 */
const express = require('express');
const router = express.Router();
const { getPool } = require('../database/db');
const pkg = require('../../package.json');

/**
 * GET /health
 * Basic health check for load balancers
 */
router.get('/', async (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /health/detailed
 * Detailed health check with DB status, memory, version
 */
router.get('/detailed', async (req, res) => {
    const health = {
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: pkg.version,
        uptime: Math.floor(process.uptime()),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: 'MB'
        },
        database: {
            status: 'unknown'
        }
    };

    // Check database connectivity
    try {
        const pool = getPool();
        const start = Date.now();
        await pool.query('SELECT 1');
        const latency = Date.now() - start;

        health.database = {
            status: 'connected',
            latency: latency,
            latencyUnit: 'ms'
        };
    } catch (err) {
        health.status = 'degraded';
        health.database = {
            status: 'error',
            message: err.message
        };
    }

    // Overall status code
    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

/**
 * GET /health/ready
 * Readiness check - returns 200 only if fully ready to serve
 */
router.get('/ready', async (req, res) => {
    try {
        const pool = getPool();
        await pool.query('SELECT 1');
        res.json({ ready: true });
    } catch (err) {
        res.status(503).json({ ready: false, error: err.message });
    }
});

/**
 * GET /health/live
 * Liveness check - process is running
 */
router.get('/live', (req, res) => {
    res.json({ alive: true });
});

module.exports = router;
