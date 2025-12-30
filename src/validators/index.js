/**
 * Input Validators using Joi
 * Centralized validation for all API inputs
 */
const Joi = require('joi');

// Brazilian phone validation (10-11 digits, optionally with +55)
// Brazilian phone validation (10-11 digits, optionally with +55, strips formatting)
const phoneSchema = Joi.string()
    .custom((value, helpers) => {
        if (!value) return value;
        // Remove non-digits
        const clean = value.replace(/\D/g, '');
        // Validate format (10-11 digits, or 12-13 with 55)
        if (!/^(\+?55)?[1-9][0-9]{9,10}$/.test(clean)) {
            return helpers.error('string.pattern.base');
        }
        return clean;
    })
    .required()
    .messages({
        'string.pattern.base': 'Telefone deve ter formato brasileiro válido (ex: 11999999999)',
        'any.required': 'Telefone é obrigatório'
    });

// Name validation (2-100 chars, no special HTML chars)
const nameSchema = Joi.string()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .required()
    .messages({
        'string.min': 'Nome deve ter pelo menos 2 caracteres',
        'string.max': 'Nome não pode ter mais de 100 caracteres',
        'string.pattern.base': 'Nome contém caracteres inválidos',
        'any.required': 'Nome é obrigatório'
    });

// Token validation (hexadecimal, 8-64 chars)
const tokenSchema = Joi.string()
    .pattern(/^[a-f0-9]{8,64}$/i)
    .allow(null, '')
    .messages({
        'string.pattern.base': 'Token inválido'
    });

// Device ID validation
const deviceIdSchema = Joi.string()
    .max(255)
    .optional();

// LGPD consent
const consentSchema = Joi.boolean()
    .valid(true)
    .required()
    .messages({
        'any.only': 'Você precisa aceitar os termos para continuar',
        'any.required': 'Consentimento é obrigatório'
    });

// Schemas for API endpoints
const schemas = {
    // POST /api/amigos/start
    startClaim: Joi.object({
        phone: phoneSchema.optional(), // Optional on start
        promo_token: tokenSchema.optional(),
        device_id: deviceIdSchema
    }),

    // POST /api/amigos/finish
    finishClaim: Joi.object({
        claim_session_id: Joi.string().required(),
        phone: phoneSchema,
        name: nameSchema,
        shared_status: Joi.string().optional(),
        promo_token: tokenSchema.optional(),
        lgpd_consent: consentSchema,
        device_id: deviceIdSchema
    }),

    // GET /api/amigos/status or /lookup
    phoneQuery: Joi.object({
        phone: phoneSchema
    })
};

/**
 * Validation middleware factory
 * @param {string} schemaName - Name of schema to use
 * @param {string} source - 'body', 'query', or 'params'
 */
function validate(schemaName, source = 'body') {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            return next(new Error(`Schema '${schemaName}' not found`));
        }

        const dataToValidate = req[source];
        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const messages = error.details.map(d => d.message);
            console.warn('[Validation Error]', messages);
            return res.status(400).json({
                success: false,
                error: messages.join(', '), // Show actual error to client for debugging
                details: messages
            });
        }

        // Replace with validated/sanitized data
        req[source] = value;
        next();
    };
}

module.exports = {
    validate,
    schemas,
    phoneSchema,
    nameSchema,
    tokenSchema
};
