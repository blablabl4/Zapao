function requireAdmin(req, res, next) {
    // Check if session exists and has admin info
    if (req.session && req.session.adminId) {
        return next();
    }

    // Not authenticated
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        // API request - return JSON error
        return res.status(401).json({
            error: 'Não autorizado',
            redirect: '/admin/login'
        });
    }

    // Regular request - redirect to login
    return res.redirect('/admin/login');
}

module.exports = { requireAdmin };
