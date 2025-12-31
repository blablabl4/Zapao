const { MercadoPagoConfig, Payment } = require('mercadopago');
const fs = require('fs');
const path = require('path');

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
if (!ACCESS_TOKEN) process.exit(1);

const client = new MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
const payment = new Payment(client);

// Orphan Payment IDs (only real bolão payments, excluding fees and tests)
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
    '140054102170' // The R$100 one (5 cotas)
];

async function fetchOrphanDetails() {
    console.log('--- Fetching Orphan Payer Details from MP ---');
    console.log(`Total IDs to fetch: ${orphanIds.length}\n`);

    const results = [];

    for (const id of orphanIds) {
        try {
            const p = await payment.get({ id: id });

            const amount = p.transaction_amount;
            const cotas = Math.round(amount / 20);

            // Convert timestamp to Brasília
            const dateApproved = new Date(p.date_approved);
            const brTime = dateApproved.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

            // Determine which "jogo" based on timestamp
            // 15:30-15:41 on 30/12 = First wave = Jogo 1
            let jogo = 'Jogo 1 (Abertura)';

            const payer = p.payer || {};
            const name = ((payer.first_name || '') + ' ' + (payer.last_name || '')).trim() || 'N/A';
            const email = payer.email || 'N/A';
            const phone = payer.phone?.number ? `${payer.phone.area_code || ''}${payer.phone.number}` : 'N/A';
            const cpf = payer.identification?.number || 'N/A';

            results.push({
                mp_id: id,
                name,
                email,
                phone,
                cpf,
                amount,
                cotas,
                time: brTime,
                jogo
            });

            console.log(`[${id}] ${name} | R$ ${amount} (${cotas} cotas) | ${brTime}`);

        } catch (e) {
            console.error(`[${id}] ERROR: ${e.message}`);
            results.push({ mp_id: id, error: e.message });
        }
    }

    // Generate Markdown Report
    let md = `# 📋 Lista de Órfãos Extraídos do MP\n\n`;
    md += `**Data:** ${new Date().toLocaleString('pt-BR')}\n`;
    md += `**Total:** ${results.filter(r => !r.error).length} pagamentos\n\n`;
    md += `---\n\n`;
    md += `| # | Nome | Telefone | Valor | Cotas | Horário | Jogo |\n`;
    md += `|---|------|----------|-------|-------|---------|------|\n`;

    let totalCotas = 0;
    results.filter(r => !r.error).forEach((r, i) => {
        md += `| ${i + 1} | ${r.name} | ${r.phone} | R$ ${r.amount} | ${r.cotas} | ${r.time} | ${r.jogo} |\n`;
        totalCotas += r.cotas;
    });

    md += `\n---\n\n`;
    md += `## Resumo\n`;
    md += `- **Total de Pagamentos:** ${results.filter(r => !r.error).length}\n`;
    md += `- **Total de Cotas Necessárias:** ${totalCotas}\n`;
    md += `- **Bolão Identificado:** Jogo 1 (Abertura - 15:30 do dia 30/12)\n`;

    const reportPath = path.join(__dirname, 'orphan_payers_list.md');
    fs.writeFileSync(reportPath, md);
    console.log(`\n✅ Report saved to: ${reportPath}`);
}

fetchOrphanDetails();
