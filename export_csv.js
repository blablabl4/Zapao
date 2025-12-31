const { query } = require('./src/database/db');
const fs = require('fs');
const path = require('path');

async function exportCsv() {
    console.log('--- Exporting Participants CSV ---');
    const CAMPAIGN_ID = 21;
    const FILE_PATH = path.join(__dirname, 'participantes_bolao.csv');

    try {
        const sql = `
            SELECT c.name, c.phone, c.round_number, count(t.id) as ticket_qty
            FROM az_claims c
            JOIN az_tickets t ON t.assigned_claim_id = c.id
            WHERE c.campaign_id=$1 AND c.status='PAID'
            GROUP BY c.id, c.name, c.phone, c.round_number
            ORDER BY c.round_number ASC, c.name ASC
        `;

        const res = await query(sql);

        // CSV Header
        let csvContent = "Nome,Telefone,Jogo,Quantidade de Cotas\n";

        res.rows.forEach(r => {
            // Escape quotes in name if necessary
            const cleanName = r.name ? r.name.replace(/"/g, '""') : "";
            const phone = r.phone || "";
            csvContent += `"${cleanName}",${phone},${r.round_number},${r.ticket_qty}\n`;
        });

        fs.writeFileSync(FILE_PATH, csvContent);
        console.log(`✅ CSV generated successfully at: ${FILE_PATH}`);
        console.log(`Total Rows: ${res.rows.length}`);

    } catch (e) {
        console.error(e);
    }
}
exportCsv();
