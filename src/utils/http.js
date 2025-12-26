/**
 * HTTP Request Utilities
 */

/**
 * Extract request info for logging and security
 * Handles X-Forwarded-For parsing and truncation for DB safety
 * @param {object} req - Express request object
 * @returns {object} { ip, ua, deviceId }
 */
const getRequestInfo = (req) => {
    let ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    // Handle multiple IPs in x-forwarded-for (client, proxy1, proxy2)
    // We want the FIRST one (client)
    if (ip && typeof ip === 'string' && ip.indexOf(',') > -1) {
        ip = ip.split(',')[0].trim();
    }

    // Ensure string
    ip = String(ip);

    // Truncate to fit database (VARCHAR(50))
    if (ip.length > 50) {
        ip = ip.substring(0, 50);
    }

    return {
        ip: ip,
        ua: req.headers['user-agent'] || '',
        deviceId: req.headers['x-device-id'] || req.body?.device_id || null
    };
};

module.exports = {
    getRequestInfo
};
