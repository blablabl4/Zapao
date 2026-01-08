/**
 * Validação Completa - Textos, Mensagens de Erro, UI
 * Verifica TUDO relacionado ao range 1-150
 */

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════');
console.log('  VALIDAÇÃO ULTRA-COMPLETA: RANGE 1-150');
console.log('  Checando código, textos, mensagens, comments');
console.log('═══════════════════════════════════════════════════════════\n');

let total = 0;
let passed = 0;
let failed = 0;

function check(file, name, condition, expected, actual = '') {
    total++;
    const shortFile = file.split('/').pop();

    if (condition) {
        console.log(`✅ ${shortFile}: ${name}`);
        passed++;
    } else {
        console.log(`❌ ${shortFile}: ${name}`);
        if (expected) console.log(`   Esperado: ${expected}`);
        if (actual) console.log(`   Atual: ${actual}`);
        failed++;
    }
}

function searchInFile(filePath, regex) {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) return [];

    const content = fs.readFileSync(fullPath, 'utf8');
    const matches = content.match(regex);
    return matches || [];
}

function fileContains(filePath, text) {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) return false;

    const content = fs.readFileSync(fullPath, 'utf8');
    return content.includes(text);
}

// ============ FRONTEND HTML ============
console.log('📄 HTML FILES\n');

check('public/zapao-da-sorte.html', 'Meta description "01 a 150"',
    fileContains('public/zapao-da-sorte.html', '01 a 150'));

check('public/zapao-da-sorte.html', 'Subtitle "01 a 150"',
    fileContains('public/zapao-da-sorte.html', 'Escolha um número de 01 a 150'));

check('public/zapao-da-sorte.html', 'NÃO tem "00 a 99"',
    !fileContains('public/zapao-da-sorte.html', '00 a 99'));

check('public/zapao-da-sorte.html', 'NÃO tem "01 a 75"',
    !fileContains('public/zapao-da-sorte.html', '01 a 75'));

console.log('');

// ============ JAVASCRIPT - FRONTEND ============
console.log('🎨 JAVASCRIPT - FRONTEND\n');

check('public/js/zapao-logic.js', 'totalNumbers = 150',
    fileContains('public/js/zapao-logic.js', 'totalNumbers: 150'));

check('public/js/zapao-logic.js', 'Loop 1 to 150',
    fileContains('public/js/zapao-logic.js', 'for (let i = 1; i <= 150'));

check('public/js/zapao-logic.js', 'Padding 3 dígitos',
    fileContains('public/js/zapao-logic.js', 'padStart(3'));

check('public/js/zapao-logic.js', 'Comment atualizado "1-150"',
    fileContains('public/js/zapao-logic.js', '1-150'));

console.log('');

// ============ JAVASCRIPT - ADMIN ============
console.log('🔧 JAVASCRIPT - ADMIN\n');

check('public/js/admin.js', 'TOTAL_NUMBERS = 150',
    fileContains('public/js/admin.js', 'const TOTAL_NUMBERS = 150'));

check('public/js/admin.js', 'Array i + 1 (começa em 1)',
    fileContains('public/js/admin.js', '(_, i) => i + 1'));

check('public/js/admin.js', 'Random + 1 (1-150)',
    fileContains('public/js/admin.js', '* TOTAL_NUMBERS) + 1'));

console.log('');

// ============ BACKEND - MENSAGENS DE ERRO ============
console.log('⚠️  MENSAGENS DE ERRO\n');

check('src/routes/orders.js', 'Erro: "between 1 and"',
    fileContains('src/routes/orders.js', 'between 1'));

check('src/routes/orders.js', 'Erro menciona range correto',
    fileContains('src/routes/orders.js', 'Range: 1-'));

check('src/routes/orders.js', 'NÃO tem erro "0 and 99"',
    !fileContains('src/routes/orders.js', '0 and 99'));

check('src/routes/admin.js', 'Admin erro "1 and 150"',
    fileContains('src/routes/admin.js', '1 and 150'));

check('src/routes/admin.js', 'NÃO tem erro "0 and 99"',
    !fileContains('src/routes/admin.js', '0 and 99'));

console.log('');

// ============ BACKEND - VALIDAÇÕES ============
console.log('✅ VALIDAÇÕES BACKEND\n');

check('src/routes/orders.js', 'Valida < 1 (não < 0)',
    fileContains('src/routes/orders.js', 'numValue < 1'));

check('src/routes/orders.js', 'Default 150',
    fileContains('src/routes/orders.js', '|| 150'));

check('src/services/DrawService.js', 'Loop 1 to 150',
    fileContains('src/services/DrawService.js', 'i <= 150'));

check('src/services/DrawService.js', 'Default 150',
    fileContains('src/services/DrawService.js', '|| 150'));

console.log('');

// ============ MIGRATIONS ============
console.log('💾 DATABASE MIGRATIONS\n');

check('migrations/024', 'Migration 024 existe',
    fs.existsSync(path.join(__dirname, '..', 'migrations/024_update_total_numbers_to_150.sql')));

check('migrations/024', 'DEFAULT 150',
    fileContains('migrations/024_update_total_numbers_to_150.sql', 'DEFAULT 150'));

check('migrations/024', 'UPDATE to 150',
    fileContains('migrations/024_update_total_numbers_to_150.sql', 'SET total_numbers = 150'));

console.log('');

// ============ SCRIPTS ============
console.log('📜 SCRIPTS\n');

check('scripts/check_draw_status.js', 'Default 150',
    fileContains('scripts/check_draw_status.js', '|| 150'));

console.log('');

// ============ VERIFICAÇÕES EXTRAS ============
console.log('🔍 VERIFICAÇÕES EXTRAS\n');

const zapaoLogicMatches = searchInFile('public/js/zapao-logic.js', /totalNumbers:\s*(\d+)/g);
check('zapao-logic.js', 'Apenas UM totalNumbers (sem duplicatas)',
    zapaoLogicMatches.length === 1);

const adminMatches = searchInFile('public/js/admin.js', /TOTAL_NUMBERS\s*=\s*(\d+)/g);
check('admin.js', 'Apenas UM TOTAL_NUMBERS constante',
    adminMatches.length === 1);

// Verifica se não tem referências a 99 ou 100 em lugares críticos
check('zapao-logic.js', 'NÃO tem "< 100" no loop',
    !fileContains('public/js/zapao-logic.js', '< 100'));

check('zapao-logic.js', 'NÃO tem "padStart(2"',
    !fileContains('public/js/zapao-logic.js', 'padStart(2'));

console.log('');

// ============ RESUMO ============
console.log('═══════════════════════════════════════════════════════════');
console.log('📊 RESUMO FINAL\n');
console.log(`   Total de Checks: ${total}`);
console.log(`   ✅ Passou: ${passed} (${(passed / total * 100).toFixed(1)}%)`);
console.log(`   ❌ Falhou: ${failed} (${(failed / total * 100).toFixed(1)}%)`);
console.log('');

if (failed === 0) {
    console.log('🎉🎉🎉 VALIDAÇÃO 100% COMPLETA! 🎉🎉🎉\n');
    console.log('✅ Todos os textos corretos');
    console.log('✅ Todas as mensagens de erro corretas');
    console.log('✅ Todos os comentários atualizados');
    console.log('✅ Validações backend corretas');
    console.log('✅ Frontend renderizando 1-150');
    console.log('✅ Database configurado para 150');
    console.log('\n🚀 SISTEMA 100% PRONTO PARA 1-150!\n');
    process.exit(0);
} else {
    console.log('⚠️⚠️⚠️ VALIDAÇÃO INCOMPLETA ⚠️⚠️⚠️\n');
    console.log(`❌ ${failed} problema(s) encontrado(s)`);
    console.log('🔧 Revise os itens marcados com ❌\n');
    process.exit(1);
}
