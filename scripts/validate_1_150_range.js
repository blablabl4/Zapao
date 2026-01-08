/**
 * Comprehensive Validation: 1-150 Number Range
 * Validates all changes are correct across frontend, backend, and database
 */

const fs = require('fs');
const path = require('path');

console.log('=== VALIDAÇÃO COMPLETA: RANGE 1-150 ===\n');

let errors = 0;
let warnings = 0;
let successes = 0;

function checkFile(filePath, checks) {
    const fullPath = path.join(__dirname, '..', filePath);

    if (!fs.existsSync(fullPath)) {
        console.log(`❌ Arquivo não encontrado: ${filePath}`);
        errors++;
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    console.log(`📄 Validando: ${filePath}`);

    checks.forEach(check => {
        if (check.type === 'contains') {
            if (content.includes(check.value)) {
                console.log(`   ✅ ${check.description}`);
                successes++;
            } else {
                console.log(`   ❌ ${check.description}`);
                console.log(`      Esperado: "${check.value}"`);
                errors++;
            }
        } else if (check.type === 'not_contains') {
            if (!content.includes(check.value)) {
                console.log(`   ✅ ${check.description}`);
                successes++;
            } else {
                console.log(`   ❌ ${check.description}`);
                console.log(`      Não deveria conter: "${check.value}"`);
                errors++;
            }
        } else if (check.type === 'regex') {
            if (check.regex.test(content)) {
                console.log(`   ✅ ${check.description}`);
                successes++;
            } else {
                console.log(`   ❌ ${check.description}`);
                errors++;
            }
        }
    });

    console.log('');
}

// ========== FRONTEND VALIDATIONS ==========
console.log('🎨 FRONTEND\n');

checkFile('public/js/zapao-logic.js', [
    {
        type: 'contains',
        value: 'totalNumbers: 150',
        description: 'totalNumbers configurado para 150'
    },
    {
        type: 'contains',
        value: 'for (let i = 1; i <= 150; i++)',
        description: 'Loop renderiza 1 a 150'
    },
    {
        type: 'contains',
        value: '.padStart(3,',
        description: 'Números com 3 dígitos (001-150)'
    },
    {
        type: 'not_contains',
        value: 'totalNumbers: 100',
        description: 'Não tem totalNumbers: 100'
    },
    {
        type: 'not_contains',
        value: 'for (let i = 0; i < 100',
        description: 'Não tem loop 0-99'
    }
]);

checkFile('public/zapao-da-sorte.html', [
    {
        type: 'contains',
        value: '01 a 150',
        description: 'Texto "01 a 150" presente'
    },
    {
        type: 'not_contains',
        value: '00 a 99',
        description: 'Não tem texto "00 a 99"'
    },
    {
        type: 'not_contains',
        value: '01 a 75',
        description: 'Não tem texto "01 a 75"'
    }
]);

checkFile('public/js/admin.js', [
    {
        type: 'contains',
        value: 'const TOTAL_NUMBERS = 150',
        description: 'TOTAL_NUMBERS = 150'
    },
    {
        type: 'contains',
        value: '(_, i) => i + 1',
        description: 'Array começa em 1 (não 0)'
    },
    {
        type: 'contains',
        value: 'Math.random() * TOTAL_NUMBERS) + 1',
        description: 'Random gera 1-150'
    },
    {
        type: 'not_contains',
        value: 'const TOTAL_NUMBERS = 100',
        description: 'Não tem TOTAL_NUMBERS = 100'
    }
]);

// ========== BACKEND VALIDATIONS ==========
console.log('🔧 BACKEND\n');

checkFile('src/routes/orders.js', [
    {
        type: 'contains',
        value: 'numValue < 1',
        description: 'Valida mínimo: 1'
    },
    {
        type: 'contains',
        value: 'numValue > maxNum',
        description: 'Valida máximo (dinâmico)'
    },
    {
        type: 'contains',
        value: '|| 150',
        description: 'Default maxNum é 150'
    },
    {
        type: 'not_contains',
        value: 'numValue < 0',
        description: 'Não valida numValue < 0 (mudou para < 1)'
    },
    {
        type: 'not_contains',
        value: '|| 100',
        description: 'Não tem default 100 (mudou para 150)'
    }
]);

checkFile('src/services/DrawService.js', [
    {
        type: 'contains',
        value: '|| 150',
        description: 'Default total_numbers é 150'
    },
    {
        type: 'contains',
        value: 'for (let i = 1; i <= 150; i++)',
        description: 'Loop weighted draw 1-150'
    },
    {
        type: 'not_contains',
        value: 'for (let i = 0; i < 100',
        description: 'Não tem loop 0-99'
    }
]);

checkFile('src/routes/admin.js', [
    {
        type: 'contains',
        value: 'numValue < 1',
        description: 'Admin valida mínimo: 1'
    },
    {
        type: 'contains',
        value: 'numValue > 150',
        description: 'Admin valida máximo: 150'
    },
    {
        type: 'not_contains',
        value: 'numValue > 99',
        description: 'Não valida máximo 99'
    }
]);

// ========== DATABASE VALIDATIONS ==========
console.log('💾 DATABASE\n');

checkFile('migrations/024_update_total_numbers_to_150.sql', [
    {
        type: 'contains',
        value: 'DEFAULT 150',
        description: 'Migration define DEFAULT 150'
    },
    {
        type: 'contains',
        value: 'SET total_numbers = 150',
        description: 'Migration atualiza draws existentes'
    }
]);

// ========== SCRIPTS VALIDATIONS ==========
console.log('📜 SCRIPTS\n');

checkFile('scripts/check_draw_status.js', [
    {
        type: 'contains',
        value: '|| 150',
        description: 'Script usa default 150'
    }
]);

// ========== SUMMARY ==========
console.log('═'.repeat(60));
console.log('📊 RESUMO DA VALIDAÇÃO\n');
console.log(`   ✅ Sucessos: ${successes}`);
console.log(`   ❌ Erros: ${errors}`);
console.log(`   ⚠️  Avisos: ${warnings}`);
console.log('');

if (errors === 0) {
    console.log('🎉 TODAS AS VALIDAÇÕES PASSARAM!\n');
    console.log('✅ Sistema pronto para range 1-150');
    process.exit(0);
} else {
    console.log('⚠️  VALIDAÇÃO FALHOU!\n');
    console.log(`❌ ${errors} erro(s) encontrado(s)`);
    console.log('🔧 Corrija os erros antes de fazer deploy');
    process.exit(1);
}
