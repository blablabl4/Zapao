const { query } = require('./src/database/db');
const fs = require('fs');
const path = require('path');

async function exportAllClaims() {
    console.log('--- Exporting ALL Claims with Assigned Tickets ---');
    try {
        // Get all PAID claims with ticket counts, ordered by claimed_at
        const sql = `
            SELECT 
                c.id as claim_id,
                c.payment_id,
                c.name,
                c.phone,
                c.status,
                c.round_number,
                c.total_qty,
                c.claimed_at,
                count(t.id) as tickets_assigned
            FROM az_claims c
            LEFT JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE c.campaign_id = 21 AND c.status = 'PAID'
            GROUP BY c.id
            ORDER BY c.claimed_at ASC
        `;

        const res = await query(sql);
        console.log(`Found ${res.rows.length} PAID claims.\n`);

        // Generate Markdown Table
        let md = `# 📊 Auditoria Completa de Claims (Bolão C21)\n\n`;
        md += `**Data:** ${new Date().toLocaleString('pt-BR')}\n`;
        md += `**Total Claims:** ${res.rows.length}\n\n`;
        md += `---\n\n`;

        // Group by round for easier analysis
        const byRound = {};
        res.rows.forEach(r => {
            const rn = r.round_number || 'SEM_JOGO';
            if (!byRound[rn]) byRound[rn] = [];
            byRound[rn].push(r);
        });

        for (const round of Object.keys(byRound).sort()) {
            const claims = byRound[round];
            md += `## Jogo ${round} (${claims.length} pagamentos)\n\n`;
            md += `| Claim# | Payment ID | Nome | Telefone | Qty | Tickets | Data/Hora |\n`;
            md += `|--------|------------|------|----------|-----|---------|------------|\n`;

            claims.forEach(c => {
                const dt = new Date(c.claimed_at).toLocaleString('pt-BR');
                const mismatch = c.total_qty != c.tickets_assigned ? '⚠️' : '';
                md += `| ${c.claim_id} | ${c.payment_id || 'N/A'} | ${c.name} | ${c.phone} | ${c.total_qty} | ${c.tickets_assigned}${mismatch} | ${dt} |\n`;
            });
            md += `\n`;
        }

        // Summary
        md += `---\n\n## Resumo por Jogo\n\n`;
        md += `| Jogo | Claims | Total Cotas |\n`;
        md += `|------|--------|-------------|\n`;
        let totalClaims = 0, totalCotas = 0;
        for (const round of Object.keys(byRound).sort()) {
            const claims = byRound[round];
            const cotas = claims.reduce((sum, c) => sum + parseInt(c.tickets_assigned), 0);
            md += `| ${round} | ${claims.length} | ${cotas} |\n`;
            totalClaims += claims.length;
            totalCotas += cotas;
        }
        md += `| **TOTAL** | **${totalClaims}** | **${totalCotas}** |\n`;

        // Save
        const reportPath = path.join(__dirname, 'full_claims_audit.md');
        fs.writeFileSync(reportPath, md);
        console.log(`✅ Report saved to: ${reportPath}`);

        // Also generate simple text output for console review
        console.log('\n--- Quick Summary ---');
        for (const round of Object.keys(byRound).sort()) {
            const claims = byRound[round];
            const cotas = claims.reduce((sum, c) => sum + parseInt(c.tickets_assigned), 0);
            console.log(`Jogo ${round}: ${claims.length} claims, ${cotas} cotas`);
        }

    } catch (e) {
        console.error(e);
    }
}
exportAllClaims();
