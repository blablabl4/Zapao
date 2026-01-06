const Joi = require('joi');

const createOrderSchema = Joi.object({
    // Buyer Ref Format: "Nome|Telefone"
    buyer_ref: Joi.string().required().custom((value, helpers) => {
        const parts = value.split('|');
        if (parts.length < 2) {
            return helpers.message('buyer_ref inválido (formato esperado: Nome|Telefone)');
        }

        const name = parts[0];
        const phone = parts[1];

        if (name.length < 3) {
            return helpers.message('Nome muito curto no buyer_ref');
        }

        // Validate phone (10 or 11 digits)
        if (!/^\d{10,11}$/.test(phone)) {
            return helpers.message(`Telefone inválido no buyer_ref: ${phone}`);
        }

        return value;
    }),

    numbers: Joi.array()
        .items(Joi.number().integer()) // min/max checked by business logic, but could add here
        .min(1)
        .required()
        .messages({
            'array.min': 'Selecione pelo menos um número',
            'array.base': 'Números inválidos'
        }),

    cpf: Joi.string().allow('').optional(),
    email: Joi.string().allow('').optional(),

    referrer_id: Joi.any().optional(),

    // Allow unknown fields just in case frontend sends extra tracking info
}).options({ stripUnknown: true });

module.exports = { createOrderSchema };
