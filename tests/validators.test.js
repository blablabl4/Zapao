/**
 * Validator Tests
 * Tests input validation logic
 */

const { validate, schemas } = require('../src/validators');

describe('Validators', () => {
    describe('Phone Validation (phoneQuery schema)', () => {
        it('should accept valid Brazilian phone with 11 digits', () => {
            const { error } = schemas.phoneQuery.validate({ phone: '11999999999' });
            expect(error).toBeUndefined();
        });

        it('should accept valid Brazilian phone with 10 digits', () => {
            const { error } = schemas.phoneQuery.validate({ phone: '1199999999' });
            expect(error).toBeUndefined();
        });

        it('should accept phone with +55 prefix', () => {
            const { error } = schemas.phoneQuery.validate({ phone: '+5511999999999' });
            expect(error).toBeUndefined();
        });

        it('should reject phone with less than 10 digits', () => {
            const { error } = schemas.phoneQuery.validate({ phone: '119999999' });
            expect(error).toBeDefined();
        });

        it('should reject phone with letters', () => {
            const { error } = schemas.phoneQuery.validate({ phone: '11999abc999' });
            expect(error).toBeDefined();
        });

        it('should reject empty phone', () => {
            const { error } = schemas.phoneQuery.validate({ phone: '' });
            expect(error).toBeDefined();
        });

        it('should reject missing phone', () => {
            const { error } = schemas.phoneQuery.validate({});
            expect(error).toBeDefined();
        });
    });

    describe('Finish Claim Validation (finishClaim schema)', () => {
        const validData = {
            claim_session_id: 'abc123',
            phone: '11999999999',
            name: 'João Silva',
            lgpd_consent: true
        };

        it('should accept valid claim data', () => {
            const { error } = schemas.finishClaim.validate(validData);
            expect(error).toBeUndefined();
        });

        it('should reject name with less than 2 characters', () => {
            const { error } = schemas.finishClaim.validate({ ...validData, name: 'A' });
            expect(error).toBeDefined();
        });

        it('should reject name with special characters', () => {
            const { error } = schemas.finishClaim.validate({ ...validData, name: 'João<script>' });
            expect(error).toBeDefined();
        });

        it('should reject without LGPD consent', () => {
            const { error } = schemas.finishClaim.validate({ ...validData, lgpd_consent: false });
            expect(error).toBeDefined();
        });

        it('should accept name with accents', () => {
            const { error } = schemas.finishClaim.validate({ ...validData, name: 'José Antônio' });
            expect(error).toBeUndefined();
        });
    });

    describe('Token Validation', () => {
        it('should accept valid hex token', () => {
            const { error } = schemas.startClaim.validate({ promo_token: 'abc123def456' });
            expect(error).toBeUndefined();
        });

        it('should reject token with invalid characters', () => {
            const { error } = schemas.startClaim.validate({ promo_token: 'abc123-xyz!' });
            expect(error).toBeDefined();
        });

        it('should accept empty promo_token (optional)', () => {
            const { error } = schemas.startClaim.validate({});
            expect(error).toBeUndefined();
        });
    });

    describe('Validate Middleware', () => {
        it('should be a function', () => {
            expect(typeof validate).toBe('function');
        });

        it('should return a middleware function', () => {
            const middleware = validate('phoneQuery', 'query');
            expect(typeof middleware).toBe('function');
        });
    });
});
