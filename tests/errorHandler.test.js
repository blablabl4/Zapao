/**
 * API Route Tests
 * Integration tests for the Amigos API endpoints
 * Note: These tests mock the database to avoid external dependencies
 */

const { ApiResponse, ErrorTypes, AppError } = require('../src/middleware/errorHandler');

describe('Error Handler', () => {
    describe('ApiResponse', () => {
        it('should format success response correctly', () => {
            const response = ApiResponse.success({ id: 1, name: 'Test' });
            expect(response.success).toBe(true);
            expect(response.data).toEqual({ id: 1, name: 'Test' });
        });

        it('should format success response with message', () => {
            const response = ApiResponse.success({ id: 1 }, 'Created successfully');
            expect(response.success).toBe(true);
            expect(response.message).toBe('Created successfully');
        });

        it('should format error response correctly', () => {
            const response = ApiResponse.error('Something went wrong');
            expect(response.success).toBe(false);
            expect(response.error).toBe('Something went wrong');
        });

        it('should format error response with details', () => {
            const response = ApiResponse.error('Validation failed', ['Field required']);
            expect(response.details).toEqual(['Field required']);
        });

        it('should format paginated response', () => {
            const response = ApiResponse.paginated([1, 2, 3], 1, 10, 25);
            expect(response.success).toBe(true);
            expect(response.data).toEqual([1, 2, 3]);
            expect(response.pagination.page).toBe(1);
            expect(response.pagination.limit).toBe(10);
            expect(response.pagination.total).toBe(25);
            expect(response.pagination.pages).toBe(3);
        });
    });

    describe('AppError', () => {
        it('should create operational error by default', () => {
            const error = new AppError('Test error', 400);
            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(400);
            expect(error.isOperational).toBe(true);
        });

        it('should allow non-operational errors', () => {
            const error = new AppError('Bug!', 500, false);
            expect(error.isOperational).toBe(false);
        });

        it('should have timestamp', () => {
            const error = new AppError('Test');
            expect(error.timestamp).toBeDefined();
        });
    });

    describe('ErrorTypes', () => {
        it('should create validation error', () => {
            const error = ErrorTypes.VALIDATION('Invalid input');
            expect(error.statusCode).toBe(400);
            expect(error.message).toBe('Invalid input');
        });

        it('should create not found error', () => {
            const error = ErrorTypes.NOT_FOUND('User');
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('User não encontrado');
        });

        it('should create unauthorized error', () => {
            const error = ErrorTypes.UNAUTHORIZED();
            expect(error.statusCode).toBe(401);
        });

        it('should create rate limit error', () => {
            const error = ErrorTypes.RATE_LIMIT();
            expect(error.statusCode).toBe(429);
        });

        it('should create internal error as non-operational', () => {
            const error = ErrorTypes.INTERNAL();
            expect(error.statusCode).toBe(500);
            expect(error.isOperational).toBe(false);
        });
    });
});

describe('Config', () => {
    // Store original env
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset modules to test config loading
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('should have required config values in test environment', () => {
        process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
        process.env.SESSION_SECRET = 'test-secret';

        const config = require('../src/config');
        expect(config.SESSION_SECRET).toBe('test-secret');
        expect(config.DATABASE_URL).toBe('postgresql://test:test@localhost/test');
    });

    it('should have default PORT', () => {
        process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
        process.env.SESSION_SECRET = 'test-secret';

        const config = require('../src/config');
        expect(config.PORT).toBe(3000);
    });
});
