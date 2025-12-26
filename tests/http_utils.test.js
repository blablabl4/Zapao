const { getRequestInfo } = require('../src/utils/http');

describe('HTTP Utils', () => {

    test('getRequestInfo should extract client IP from X-Forwarded-For', () => {
        const req = {
            headers: {
                'x-forwarded-for': '203.0.113.1, 198.51.100.1',
                'user-agent': 'TestAgent'
            },
            socket: { remoteAddress: '127.0.0.1' }
        };
        const info = getRequestInfo(req);
        expect(info.ip).toBe('203.0.113.1');
    });

    test('getRequestInfo should truncate extremely long IPs (DB Safety)', () => {
        // Create a fake long IP (e.g. IPv6 loop or attack payload)
        const longIp = '2001:0db8:85a3:0000:0000:8a2e:0370:7334:extra:garbage:that:should:be:truncated';
        const req = {
            headers: {
                'x-forwarded-for': longIp
            }
        };
        const info = getRequestInfo(req);
        expect(info.ip.length).toBeLessThanOrEqual(50);
        expect(info.ip).toBe(longIp.substring(0, 50));
    });

    test('getRequestInfo should handle empty headers gracefully', () => {
        const req = { headers: {}, socket: {} };
        const info = getRequestInfo(req);
        expect(info.ip).toBeDefined();
        expect(info.ua).toBe('');
    });
});
