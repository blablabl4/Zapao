require('dotenv').config();
const { query } = require('../src/database/db');

/**
 * Test script to verify number range validation (0-99)
 */
async function testNumberRange() {
    console.log('=== Testing Number Range Validation (0-99) ===\n');

    try {
        // Get current draw
        const drawResult = await query(`
            SELECT * FROM draws 
            WHERE status IN ('ACTIVE', 'SCHEDULED', 'PAUSED') 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        if (!drawResult.rows.length) {
            console.log('❌ No active draw found. Create a draw first.');
            process.exit(1);
        }

        const draw = drawResult.rows[0];
        console.log(`✅ Found active draw: ${draw.draw_name} (ID: ${draw.id})`);
        console.log(`   Total Numbers: ${draw.total_numbers || 100}`);
        console.log(`   Sales Locked: ${draw.sales_locked}\n`);

        // Test Cases
        const testCases = [
            { number: 0, shouldPass: true, description: 'First number (00)' },
            { number: 50, shouldPass: true, description: 'Mid-range (50)' },
            { number: 99, shouldPass: true, description: 'Last number (99)' },
            { number: 100, shouldPass: false, description: 'Out of range (100)' },
            { number: -1, shouldPass: false, description: 'Negative number (-1)' }
        ];

        console.log('Running validation tests...\n');

        for (const test of testCases) {
            const maxNum = draw.total_numbers || 100;
            const isValid = !isNaN(test.number) && test.number >= 0 && test.number < maxNum;
            const passed = isValid === test.shouldPass;
            const icon = passed ? '✅' : '❌';

            console.log(`${icon} Test: ${test.description}`);
            console.log(`   Number: ${test.number} | Expected: ${test.shouldPass ? 'PASS' : 'FAIL'} | Got: ${isValid ? 'PASS' : 'FAIL'}`);

            if (!passed) {
                console.log(`   ⚠️  VALIDATION MISMATCH!\n`);
            } else {
                console.log('');
            }
        }

        // Check existing orders
        const orderStats = await query(`
            SELECT 
                MIN(number) as min_number,
                MAX(number) as max_number,
                COUNT(*) as total_orders
            FROM orders
            WHERE draw_id = $1
        `, [draw.id]);

        if (orderStats.rows[0].total_orders > 0) {
            console.log('📊 Current Draw Orders:');
            console.log(`   Min Number: ${orderStats.rows[0].min_number}`);
            console.log(`   Max Number: ${orderStats.rows[0].max_number}`);
            console.log(`   Total Orders: ${orderStats.rows[0].total_orders}\n`);
        }

        console.log('✅ All validation tests completed!\n');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testNumberRange();
