const { MercadoPagoConfig, Payment } = require('mercadopago');
const { query } = require('./src/database/db');
const fs = require('fs');
const path = require('path');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

// Orphan Payment IDs (real bolão payments only)
const orphanIds = [
    '139412630673', '140059972842', '139409264031', '139412442525', '140059537000',
    '140058611288', '139412630417', '140058825320', '140059552894', '140059370912',
    '139409489769', '139410505449', '140060008602', '140060024606', '139412630341',
    '140057329862', '139408798001', '140058825212', '140059144922', '140058307374',
    '139410505347', '140059026984', '140059370810', '140058741130', '139410289365',
    '140058307334', '139412026495', '139409089883', '139410992949', '140060598166',
    '140059026908', '140059736552', '139409785471', '140059664600', '139410505205',
    '139412442243', '140057329702', '139410505197', '140059026868', '140058131196',
    '139411892485', '140057329680', '140059902438', '139410451163', '139410289241',
    '139410505139', '139408853871', '140056224096', '140059972312', '140058131128',
    '140054102170'
];

async function extractAndMatch() {
    console.log('--- Extracting Phones from MP Email Field ---');
    console.log(`Total IDs: ${orphanIds.length}\n`);

    const results = [];

    for (const id of orphanIds) {
        try {
            const p = await payment.get({ id: id });

            const amount = p.transaction_amount;
            const cotas = Math.round(amount / 20);
            const email = p.payer?.email || '';

            // Extract phone from email (format: PHONE@tvzapao.com.br)
            let phone = 'N/A';
            if (email && email.includes('@')) {
                const phonePart = email.split('@')[0];
                // Remove any masking asterisks if present
                if (phonePart && !phonePart.includes('*')) {
                    phone = phonePart;
                } else {
                    // Try to get from the visible part
                    phone = phonePart.replace(/\*/g, '');
                }
            }

            // Convert timestamp to Brasília
            const dateApproved = new Date(p.date_approved);
            const brTime = dateApproved.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

            // Try to find matching name in our database by phone
            let name = 'N/A';
            if (phone && phone.length >= 8) {
                const match = await query(
                    "SELECT name FROM az_claims WHERE phone LIKE $1 LIMIT 1",
                    [`%${phone.slice(-8)}%`]
                );
                if (match.rows.length > 0) {
                    name = match.rows[0].name;
                }
            }

            results.push({
                mp_id: id,
                phone,
                email,
                name,
                amount,
                cotas,
                time: brTime
            });

            console.log(`[${id}] Phone: ${phone} | Name: ${name} | R$ ${amount} (${cotas} cotas)`);

        } catch (e) {
            console.error(`[${id}] ERROR: ${e.message}`);
            results.push({ mp_id: id, error: e.message });
        }
    }

    // Generate report
    let md = `# 📋 Lista de Órfãos com Telefones\n\n`;
    md += `**Data:** ${new Date().toLocaleString('pt-BR')}\n`;
    md += `**Total:** ${results.filter(r => !r.error).length} pagamentos\n\n`;
    md += `---\n\n`;
    md += `| # | Telefone | Nome (DB) | Valor | Cotas | Horário |\n`;
    md += `|---|----------|-----------|-------|-------|----------|\n`;

    let totalCotas = 0;
    let foundNames = 0;
    results.filter(r => !r.error).forEach((r, i) => {
        md += `| ${i + 1} | ${r.phone} | ${r.name} | R$ ${r.amount} | ${r.cotas} | ${r.time} |\n`;
        totalCotas += r.cotas;
        if (r.name !== 'N/A') foundNames++;
    });

    md += `\n---\n\n`;
    md += `## Resumo\n`;
    md += `- **Total de Pagamentos:** ${results.filter(r => !r.error).length}\n`;
    md += `- **Total de Cotas:** ${totalCotas}\n`;
    md += `- **Nomes Encontrados no DB:** ${foundNames}\n`;
    md += `- **Nomes Faltando:** ${results.filter(r => !r.error && r.name === 'N/A').length}\n`;

    const reportPath = path.join(__dirname, 'orphans_with_phones.md');
    fs.writeFileSync(reportPath, md);
    console.log(`\n✅ Report saved to: ${reportPath}`);
}

extractAndMatch();
