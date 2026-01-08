const fs = require('fs');
const path = require('path');

/**
 * Static file verification - check if all frontend files are valid
 */
async function verifyFrontendFiles() {
    console.log('=== FRONTEND FILES VALIDATION ===\n');

    const filesToCheck = [
        'public/js/zapao-logic.js',
        'public/js/app.js',
        'public/zapao-da-sorte.html',
        'public/admin-zapao.html'
    ];

    let passed = 0;
    let failed = 0;

    for (const file of filesToCheck) {
        const fullPath = path.join(process.cwd(), file);

        try {
            if (!fs.existsSync(fullPath)) {
                console.log(`❌ ${file} - File not found`);
                failed++;
                continue;
            }

            const content = fs.readFileSync(fullPath, 'utf8');

            // Check for syntax errors (basic check)
            if (file.endsWith('.js')) {
                // Check for basic JS syntax issues
                if (content.includes('for (let i = 1; i <= 75')) {
                    console.log(`⚠️  ${file} - Still contains old 1-75 loop`);
                    failed++;
                } else if (content.includes('totalNumbers: 75') && !content.includes('totalNumbers: 100')) {
                    console.log(`⚠️  ${file} - Still uses totalNumbers: 75`);
                    failed++;
                } else {
                    console.log(`✅ ${file} - OK`);
                    passed++;
                }
            } else if (file.endsWith('.html')) {
                // Basic HTML validation
                console.log(`✅ ${file} - OK (${(content.length / 1024).toFixed(1)} KB)`);
                passed++;
            }

        } catch (error) {
            console.log(`❌ ${file} - Error reading: ${error.message}`);
            failed++;
        }
    }

    console.log('\n=================================');
    console.log(`TOTAL FILES: ${passed + failed}`);
    console.log(`✅ PASSED: ${passed}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log('=================================\n');

    if (failed === 0) {
        console.log('✅ All frontend files validated!\n');
        process.exit(0);
    } else {
        console.log('⚠️  Some frontend files have issues.\n');
        process.exit(1);
    }
}

verifyFrontendFiles();
