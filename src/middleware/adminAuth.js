function requireAdmin(req, res, next) {
    // Check if session exists and has admin info
    if (req.session && req.session.adminId) {
        return next();
    }

    // Not authenticated - check if this is an API request
    const isApiRequest = req.path.startsWith('/api/') ||
        req.xhr ||
        req.headers.accept?.indexOf('json') > -1 ||
        req.headers['content-type']?.indexOf('json') > -1;

    if (isApiRequest) {
        // API request - return JSON error (NOT redirect)
        return res.status(401).json({
            error: 'Não autorizado',
            redirect: '/admin/login'
        });
    }

    // Regular page request - redirect to login
    return res.redirect('/admin/login');
}

module.exports = { requireAdmin };

