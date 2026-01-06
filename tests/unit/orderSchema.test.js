const { createOrderSchema } = require('../../src/validators/orderSchema');

describe('Order Schema Validation', () => {
    test('should validate correct payload', () => {
        const payload = {
            numbers: [1, 2, 3],
            buyer_ref: 'João Silva|11999999999', // 11 digits
            email: 'test@example.com'
        };
        const { error, value } = createOrderSchema.validate(payload);
        expect(error).toBeUndefined();
        expect(value.numbers).toHaveLength(3);
    });

    test('should validate phone with 10 digits', () => {
        const payload = {
            numbers: [10],
            buyer_ref: 'Maria|1198765432' // 10 digits
        };
        const { error } = createOrderSchema.validate(payload);
        expect(error).toBeUndefined();
    });

    test('should reject invalid phone in buyer_ref (too short)', () => {
        const payload = {
            numbers: [1],
            buyer_ref: 'João|123'
        };
        const { error } = createOrderSchema.validate(payload);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('Telefone inválido');
    });

    test('should reject invalid phone in buyer_ref (letters)', () => {
        const payload = {
            numbers: [1],
            buyer_ref: 'João|1199999aaaa'
        };
        const { error } = createOrderSchema.validate(payload);
        expect(error).toBeDefined();
    });

    test('should reject empty numbers array', () => {
        const payload = {
            numbers: [],
            buyer_ref: 'João|11999999999'
        };
        const { error } = createOrderSchema.validate(payload);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('pelo menos um número');
    });

    test('should reject malformed buyer_ref', () => {
        const payload = {
            numbers: [5],
            buyer_ref: 'JoãoSilvaSemBarra'
        };
        const { error } = createOrderSchema.validate(payload);
        expect(error).toBeDefined();
        expect(error.details[0].message).toContain('formato esperado');
    });
});
