const AmigosService = require('../src/services/AmigosService');
const db = require('../src/database/db'); // We will mock this

// Mock database
jest.mock('../src/database/db', () => {
    return {
        query: jest.fn(),
        getClient: jest.fn(),
        getPool: jest.fn(() => ({ end: jest.fn() }))
    };
});

describe('AmigosService - Hard Tests (Logic Verification)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset cache
        AmigosService._campaignCache = { data: null, expiresAt: 0 };
    });

    // 1. CACHE LOGIC TEST (Rigorous)
    test('getActiveCampaign: Cache Hit, Miss, and Expiration', async () => {
        // Setup mock return
        const mockCampaign = { id: 1, name: 'Cache Test', is_active: true };
        db.query.mockResolvedValue({ rows: [mockCampaign] });

        // A. Cache MISS (First call)
        const res1 = await AmigosService.getActiveCampaign();
        expect(res1).toEqual(mockCampaign);
        expect(db.query).toHaveBeenCalledTimes(1);

        // B. Cache HIT (Immediate second call)
        const res2 = await AmigosService.getActiveCampaign();
        expect(res2).toEqual(mockCampaign);
        expect(db.query).toHaveBeenCalledTimes(1); // Should NOT increment

        // C. Cache EXPIRATION
        // Mock Date.now to fast forward 61 seconds
        jest.spyOn(Date, 'now').mockImplementation(() => new Date().getTime() + 61000);

        // Mock return again for the new fetch
        db.query.mockResolvedValue({ rows: [mockCampaign] });

        const res3 = await AmigosService.getActiveCampaign();
        expect(res3).toEqual(mockCampaign);
        expect(db.query).toHaveBeenCalledTimes(2); // Should increment now

        jest.restoreAllMocks();
    });

    // 2. SHUFFLE LOGIC TEST (Statistical)
    test('populateTickets: Fisher-Yates Shuffle Verification', async () => {
        const mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        db.getClient.mockResolvedValue(mockClient);

        // Dynamic Mock to debug sequence
        let callCount = 0;
        mockClient.query.mockImplementation(async (sql, params) => {
            callCount++;
            // safe defaults for transaction
            if (sql === 'BEGIN') return {};
            if (sql === 'COMMIT') return {};
            if (sql === 'ROLLBACK') return {};

            if (sql.includes('SELECT * FROM az_campaigns')) {
                return { rows: [{ id: 1, start_number: '0', end_number: '9' }] };
            }
            if (sql.includes('INSERT INTO az_tickets')) {
                return { rowCount: 10 };
            }
            if (sql.includes('DELETE FROM az_tickets')) {
                return { rowCount: 0 };
            }
            if (sql.includes('SELECT COUNT(*)')) {
                return { rows: [{ c: 10 }] };
            }
            return { rows: [], rowCount: 0 };
        });

        await AmigosService.populateTickets(1);

        // Find the INSERT query
        const insertCall = mockClient.query.mock.calls.find(call => call[0].includes('INSERT INTO az_tickets'));
        expect(insertCall).toBeDefined();

        // Parse values
        const sql = insertCall[0];
        const valueRegex = /\(\d+, (\d+),/g;
        const matches = [...sql.matchAll(valueRegex)];
        const insertedNumbers = matches.map(m => parseInt(m[1]));

        // Integrity Checks
        expect(insertedNumbers).toHaveLength(10);
        const sorted = [...insertedNumbers].sort((a, b) => a - b);
        expect(sorted).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

        // Randomness Check (Not Sequential)
        const isSequential = insertedNumbers.every((num, i) => num === i);
        expect(isSequential).toBe(false);
    });

    // 3. TICKET SELECTION OPTIMIZATION TEST
    test('finishClaim: Must use LIMIT + SKIP LOCKED (No ORDER BY RANDOM)', async () => {
        const mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        db.getClient.mockResolvedValue(mockClient);

        const sessionData = {
            claim_session_id: 'sess',
            expires_at: new Date(Date.now() + 10000),
            campaign_id: 1
        };

        jest.spyOn(AmigosService, 'getActiveCampaign').mockResolvedValue({ id: 1, base_qty_config: {} });
        jest.spyOn(AmigosService, 'calculateNextUnlock').mockReturnValue(new Date());

        // Dynamic Mock
        mockClient.query.mockImplementation(async (sql, params) => {
            if (sql === 'BEGIN') return {};
            if (sql === 'COMMIT') return {};
            if (sql === 'ROLLBACK') return {};

            if (sql.includes('SELECT * FROM az_claims')) return { rows: [] }; // Lock check
            if (sql.includes('INSERT INTO az_claims')) return { rows: [{ id: 100 }] };
            if (sql.includes('SELECT id, number FROM az_tickets')) return { rows: [{ id: 1, number: '123' }] };
            if (sql.includes('UPDATE az_tickets')) return { rowCount: 1 };

            return { rows: [], rowCount: 0 };
        });

        await AmigosService.finishClaim(sessionData, '11999999999', 'Test', true, null);

        // Analyze Select Query
        const selectCall = mockClient.query.mock.calls.find(c => c[0].includes('SELECT id, number FROM az_tickets'));
        const querySql = selectCall[0];

        // Must rely on optimized selection
        expect(querySql).toContain('LIMIT $2');
        expect(querySql).toContain('FOR UPDATE SKIP LOCKED');
        expect(querySql).not.toContain('ORDER BY RANDOM()');
    });

    // 4. TRANSACTION SAFETY TEST
    test('finishClaim: Must Rollback on Error', async () => {
        const mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        db.getClient.mockResolvedValue(mockClient);

        const sessionData = { expires_at: new Date(Date.now() + 10000) };
        jest.spyOn(AmigosService, 'getActiveCampaign').mockResolvedValue({ id: 1 });

        mockClient.query.mockImplementation(async (sql) => {
            if (sql === 'BEGIN') return {};
            if (sql === 'ROLLBACK') return {};
            // Simulate Error
            if (sql.includes('SELECT * FROM az_claims')) throw new Error('Database Failure');
            return { rows: [] };
        });

        await expect(AmigosService.finishClaim(sessionData, '11999999999', 'Test', true))
            .rejects.toThrow('Database Failure');

        // Verify Rollback called
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
    });
});
