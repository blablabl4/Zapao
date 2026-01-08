require('dotenv').config();
const { query } = require('../src/database/db');

/**
 * Comprehensive validation script for production readiness
 */
async function validateSystem() {
    console.log('=== SYSTEM VALIDATION REPORT ===\n');

    let passed = 0;
    let failed = 0;

    try {
        // TEST 1: Database Connection
        console.log('1️⃣ Testing database connection...');
        await query('SELECT 1');
        console.log('   ✅ Database connection OK\n');
        passed++;

        // TEST 2: Check draws table schema
        console.log('2️⃣ Validating draws table schema...');
        const schemaCheck = await query(`
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'draws' AND column_name = 'total_numbers'
        `);

        if (schemaCheck.rows.length > 0) {
            const col = schemaCheck.rows[0];
            console.log(`   Column: ${col.column_name}`);
            console.log(`   Type: ${col.data_type}`);
            console.log(`   Default: ${col.column_default}`);

            if (col.column_default && col.column_default.includes('100')) {
                console.log('   ✅ Default value correctly updated to 100\n');
                passed++;
            } else {
                console.log('   ⚠️  Default value not 100 - may need migration\n');
                failed++;
            }
        }

        // TEST 3: Check active draws
        console.log('3️⃣ Checking active draws...');
        const activeDraws = await query(`
            SELECT id, draw_name, total_numbers, status 
            FROM draws 
            WHERE status IN ('ACTIVE', 'SCHEDULED', 'PAUSED') 
            ORDER BY created_at DESC
        `);

        if (activeDraws.rows.length > 0) {
            activeDraws.rows.forEach(d => {
                console.log(`   Draw: ${d.draw_name} (${d.status})`);
                console.log(`   Total Numbers: ${d.total_numbers}`);
            });
            console.log('   ✅ Active draws found\n');
            passed++;
        } else {
            console.log('   ℹ️  No active draws - this is OK\n');
            passed++;
        }

        // TEST 4: Check for orders with new range
        console.log('4️⃣ Checking order number range...');
        const rangeCheck = await query(`
            SELECT 
                MIN(number) as min_num,
                MAX(number) as max_num,
                COUNT(*) as total_orders,
                COUNT(DISTINCT number) as unique_numbers
            FROM orders
            WHERE status = 'PAID'
        `);

        const stats = rangeCheck.rows[0];
        console.log(`   Min number: ${stats.min_num}`);
        console.log(`   Max number: ${stats.max_num}`);
        console.log(`   Total orders: ${stats.total_orders}`);
        console.log(`   Unique numbers: ${stats.unique_numbers}`);

        // Check if any orders exist with 0 or 76-99
        const newRangeCheck = await query(`
            SELECT COUNT(*) as new_range_orders
            FROM orders
            WHERE number = 0 OR (number >= 76 AND number <= 99)
        `);

        const newOrders = parseInt(newRangeCheck.rows[0].new_range_orders);
        if (newOrders > 0) {
            console.log(`   ✅ Found ${newOrders} orders in new range (0 or 76-99)\n`);
        } else {
            console.log(`   ℹ️  No orders yet in extended range (expected before first use)\n`);
        }
        passed++;

        // TEST 5: Validate orders table integrity
        console.log('5️⃣ Checking orders table integrity...');
        const integrityCheck = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE number < 0) as negative_numbers,
                COUNT(*) FILTER (WHERE number >= 100) as over_range
            FROM orders
        `);

        const integrity = integrityCheck.rows[0];
        if (parseInt(integrity.negative_numbers) === 0 && parseInt(integrity.over_range) === 0) {
            console.log('   ✅ All order numbers within valid range\n');
            passed++;
        } else {
            console.log(`   ❌ Found invalid numbers: ${integrity.negative_numbers} negative, ${integrity.over_range} >= 100\n`);
            failed++;
        }

        // TEST 6: Check migration history
        console.log('6️⃣ Validating migration history...');
        const migrationCheck = await query(`
            SELECT COUNT(*) as count
            FROM schema_migrations 
            WHERE migration_name = '023_update_total_numbers_default.sql'
        `);

        if (parseInt(migrationCheck.rows[0].count) > 0) {
            console.log('   ✅ Migration 023 executed successfully\n');
            passed++;
        } else {
            console.log('   ❌ Migration 023 not found in history\n');
            failed++;
        }

        // FINAL SUMMARY
        console.log('=================================');
        console.log(`TOTAL TESTS: ${passed + failed}`);
        console.log(`✅ PASSED: ${passed}`);
        console.log(`❌ FAILED: ${failed}`);
        console.log('=================================\n');

        if (failed === 0) {
            console.log('🎉 ALL VALIDATION CHECKS PASSED! System ready for deployment.\n');
            process.exit(0);
        } else {
            console.log('⚠️  Some checks failed. Review issues before deploying.\n');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error.message);
        process.exit(1);
    }
}

validateSystem();
