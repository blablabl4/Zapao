/**
 * Centralized Error Handler Middleware
 * Differentiates between:
 * - Operational errors (expected, e.g. validation, not found)
 * - Programming errors (bugs, unexpected)
 */

/**
 * Custom error class for operational errors
 */
class AppError extends Error {
    constructor(message, statusCode = 400, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Common error types
 */
const ErrorTypes = {
    VALIDATION: (message) => new AppError(message, 400),
    NOT_FOUND: (resource) => new AppError(`${resource} não encontrado`, 404),
    UNAUTHORIZED: (message = 'Não autorizado') => new AppError(message, 401),
    FORBIDDEN: (message = 'Acesso negado') => new AppError(message, 403),
    CONFLICT: (message) => new AppError(message, 409),
    RATE_LIMIT: () => new AppError('Muitas requisições. Aguarde alguns minutos.', 429),
    INTERNAL: (message = 'Erro interno do servidor') => new AppError(message, 500, false)
};

/**
 * Standardized API response format
 */
const ApiResponse = {
    success: (data, message = null) => ({
        success: true,
        data,
        ...(message && { message })
    }),

    error: (error, details = null) => ({
        success: false,
        error: typeof error === 'string' ? error : error.message,
        ...(details && { details })
    }),

    paginated: (data, page, limit, total) => ({
        success: true,
        data,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    })
};

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
    // Default to 500 if no status code
    err.statusCode = err.statusCode || 500;
    err.isOperational = err.isOperational !== undefined ? err.isOperational : false;

    // Log based on error type
    if (err.isOperational) {
        // Operational: expected errors, log normally
        console.log(`[Operational Error] ${err.statusCode} - ${err.message}`);
    } else {
        // Programming error: log full stack as critical
        console.error('❌ [CRITICAL ERROR]', {
            message: err.message,
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    }

    // Send response
    res.status(err.statusCode).json(
        ApiResponse.error(
            err.isOperational ? err.message : 'Ocorreu um erro inesperado',
            process.env.NODE_ENV !== 'production' ? err.stack : undefined
        )
    );
}

/**
 * Async handler wrapper - catches errors in async routes
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Not found handler for unmatched routes
 */
function notFoundHandler(req, res, next) {
    next(ErrorTypes.NOT_FOUND('Rota'));
}

module.exports = {
    AppError,
    ErrorTypes,
    ApiResponse,
    errorHandler,
    asyncHandler,
    notFoundHandler
};
