const Logger = require('../services/LoggerService');

/**
 * Generic middleware to validate request body/query/params against Joi schema
 * @param {object} schema - Joi schema object
 * @param {string} property - Request property to validate (body, query, params)
 */
const validateRequest = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false, // Return all errors
            stripUnknown: true // Remove unknown fields
        });

        if (error) {
            const errorMessage = error.details.map(d => d.message).join(', ');
            Logger.warn('VALIDATION_ERROR', `Invalid request data`, { error: errorMessage, ip: req.ip });

            return res.status(400).json({
                success: false,
                error: 'Dados inválidos',
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message
                }))
            });
        }

        // Replace request data with validated (and stripped) data
        req[property] = value;
        next();
    };
};

module.exports = validateRequest;
