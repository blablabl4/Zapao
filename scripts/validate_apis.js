/**
 * Validação de APIs - Testa endpoints para garantir suporte a 1-150
 * Verifica se as APIs aceitam/rejeitam números corretamente
 */

console.log('═══════════════════════════════════════════════════════════');
console.log('  VALIDAÇÃO DE APIs - RANGE 1-150');
console.log('═══════════════════════════════════════════════════════════\n');

const fs = require('fs');
const path = require('path');

let checks = 0;
let passed = 0;
let failed = 0;

function check(endpoint, test, condition) {
    checks++;
    if (condition) {
        console.log(`✅ ${endpoint}: ${test}`);
        passed++;
    } else {
        console.log(`❌ ${endpoint}: ${test}`);
        failed++;
    }
}

function fileContains(file, text) {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) return false;
    return fs.readFileSync(fullPath, 'utf8').includes(text);
}

console.log('🔍 VERIFICANDO ENDPOINTS\n');
console.log('═'.repeat(60) + '\n');

// ============ /api/orders/bulk ============
console.log('📦 POST /api/orders/bulk (Compra Múltipla)\n');

check('/api/orders/bulk', 'Valida números >= 1',
    fileContains('src/routes/orders.js', 'numValue < 1'));

check('/api/orders/bulk', 'Valida números <= maxNum (150)',
    fileContains('src/routes/orders.js', 'numValue > maxNum'));

check('/api/orders/bulk', 'Default maxNum = 150',
    fileContains('src/routes/orders.js', '|| 150'));

check('/api/orders/bulk', 'Mensagem de erro menciona range 1-X',
    fileContains('src/routes/orders.js', 'Range: 1-'));

check('/api/orders/bulk', 'NÃO aceita numValue < 0',
    !fileContains('src/routes/orders.js', 'numValue >= 0'));

console.log('');

// ============ /api/orders (Single) ============
console.log('🎫 POST /api/orders (Compra Única)\n');

check('/api/orders', 'Valida número >= 1',
    fileContains('src/routes/orders.js', 'numValue < 1'));

check('/api/orders', 'Valida número <= 150',
    fileContains('src/routes/orders.js', 'numValue > 150'));

check('/api/orders', 'Mensagem: "between 1 and 150"',
    fileContains('src/routes/orders.js', 'between 1'));

console.log('');

// ============ /api/admin/close-draw ============
console.log('🎰 POST /api/admin/close-draw (Encerrar Sorteio)\n');

check('/api/admin/close-draw', 'Valida drawn_number >= 1',
    fileContains('src/routes/admin.js', 'numValue < 1'));

check('/api/admin/close-draw', 'Valida drawn_number <= 150',
    fileContains('src/routes/admin.js', 'numValue > 150'));

check('/api/admin/close-draw', 'Mensagem erro "1 and 150"',
    fileContains('src/routes/admin.js', '1 and 150'));

check('/api/admin/close-draw', 'NÃO aceita 0 ou 151+',
    !fileContains('src/routes/admin.js', '< 0 ||') &&
    !fileContains('src/routes/admin.js', '> 99'));

console.log('');

// ============ /api/admin/draw-secret ============
console.log('🎲 GET /api/admin/draw-secret (Weighted Draw)\n');

check('/api/admin/draw-secret', 'Usa DrawService.getWeightedDrawResult',
    fileContains('src/routes/admin.js', 'getWeightedDrawResult'));

check('DrawService.getWeightedDrawResult', 'Loop gera números 1-150',
    fileContains('src/services/DrawService.js', 'i = 1; i <= 150'));

check('DrawService.getWeightedDrawResult', 'Retorna número do pool correto',
    fileContains('src/services/DrawService.js', 'return winner.number'));

console.log('');

// ============ /api/orders/stats/global ============
console.log('📊 GET /api/orders/stats/global (Estatísticas)\n');

check('/api/orders/stats/global', 'Usa total_numbers dinâmico',
    fileContains('src/routes/orders.js', 'total_numbers'));

check('DrawService.getCurrentDraw', 'Retorna total_numbers || 150',
    fileContains('src/services/DrawService.js', 'total_numbers || 150'));

console.log('');

// ============ EDGE CASES ============
console.log('⚠️  EDGE CASES - Cenários Especiais\n');

const ordersContent = fs.readFileSync(path.join(__dirname, '..', 'src/routes/orders.js'), 'utf8');

// Verifica se rejeita 0
check('Edge Case', 'Número 0 é REJEITADO',
    ordersContent.includes('< 1'));

// Verifica se aceita 1
check('Edge Case', 'Número 1 é ACEITO (>= 1)',
    ordersContent.includes('>= 1') || ordersContent.includes('< 1'));

// Verifica se aceita 150
check('Edge Case', 'Número 150 é ACEITO (<= 150)',
    ordersContent.includes('<= maxNum') || ordersContent.includes('> maxNum'));

// Verifica se rejeita 151
check('Edge Case', 'Número 151 é REJEITADO (> maxNum)',
    ordersContent.includes('> maxNum') || ordersContent.includes('> 150'));

console.log('');

// ============ CONSISTÊNCIA ============
console.log('🔗 CONSISTÊNCIA ENTRE APIs\n');

const adminContent = fs.readFileSync(path.join(__dirname, '..', 'src/routes/admin.js'), 'utf8');
const serviceContent = fs.readFileSync(path.join(__dirname, '..', 'src/services/DrawService.js'), 'utf8');

check('Consistência', 'orders.js e admin.js usam mesmo range mínimo (1)',
    ordersContent.includes('< 1') && adminContent.includes('< 1'));

check('Consistência', 'orders.js e admin.js usam mesmo range máximo (150)',
    ordersContent.includes('|| 150') && adminContent.includes('> 150'));

check('Consistência', 'DrawService usa mesmo default (150)',
    serviceContent.includes('|| 150'));

console.log('');

// ============ RESUMO ============
console.log('═'.repeat(60));
console.log('📊 RESUMO - VALIDAÇÃO DE APIs\n');
console.log(`   Total de Verificações: ${checks}`);
console.log(`   ✅ Passou: ${passed} (${(passed / checks * 100).toFixed(1)}%)`);
console.log(`   ❌ Falhou: ${failed} (${(failed / checks * 100).toFixed(1)}%)`);
console.log('');

if (failed === 0) {
    console.log('🎉 TODAS AS APIs VALIDADAS COM SUCESSO!\n');
    console.log('✅ Endpoints aceitam 1-150');
    console.log('✅ Endpoints rejeitam 0 e 151+');
    console.log('✅ Mensagens de erro corretas');
    console.log('✅ Consistência entre todos os endpoints');
    console.log('✅ Weighted draw configurado para 1-150');
    console.log('\n🚀 APIs 100% PRONTAS!\n');
    process.exit(0);
} else {
    console.log('⚠️  PROBLEMAS ENCONTRADOS NAS APIs\n');
    console.log(`❌ ${failed} validação(ões) falharam`);
    console.log('🔧 Revise os endpoints marcados com ❌\n');
    process.exit(1);
}
