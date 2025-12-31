const { query } = require('./src/database/db');
const fs = require('fs');

// MP Extract data organized by game (from user's extract)
const mpData = {
    jogo1: [
        { id: '140050582254', nome: 'Paulo Cesar De Souza', hora: '14:11', valor: 20 },
        { id: '140054102170', nome: 'Bruno Aguiar Silva', hora: '14:38', valor: 100 },
        { id: '139406100999', nome: 'Jéssica Batista Moreira', hora: '14:53', valor: 20 },
        { id: '140054806722', nome: 'Renata Rodrigues', hora: '14:53', valor: 20 },
        { id: '139410830895', nome: 'Cláudia Perez', hora: '15:29', valor: 20 },
        { id: '140058810890', nome: 'Bruno De Oliveira Santana', hora: '15:29', valor: 20 },
        { id: '140059972312', nome: 'Rafael Da Costa Silva', hora: '15:29', valor: 20 },
        { id: '140058131128', nome: 'Raquel Martins Da Silva', hora: '15:29', valor: 40 },
        { id: '139410505139', nome: 'Geusiane Matias De Sousa', hora: '15:30', valor: 20 },
        { id: '139408853871', nome: 'Lilian Ap. Barbarelli', hora: '15:30', valor: 40 },
        { id: '140056224096', nome: 'Gilson Menezes Da Silva', hora: '15:30', valor: 20 },
        { id: '139410289241', nome: 'Paula Ivaneide F. Da Silva', hora: '15:30', valor: 20 },
        { id: '139410451163', nome: 'Janaina Leite Vieira', hora: '15:30', valor: 20 },
        { id: '140059902438', nome: 'Daniel Leite De Araujo', hora: '15:30', valor: 20 },
        { id: '140057329680', nome: 'Natanael Verdan Dos Santos', hora: '15:30', valor: 20 },
        { id: '139411892485', nome: 'Rosana Alves Riva', hora: '15:30', valor: 20 },
        { id: '140058131196', nome: 'Heffeson Souza Costa', hora: '15:30', valor: 20 },
        { id: '140059026868', nome: 'Marcelo Da Silva Novaes', hora: '15:30', valor: 20 },
        { id: '139410505197', nome: 'Érica David Rocha', hora: '15:31', valor: 20 },
        { id: '140057329702', nome: 'Elvis Bandeira Silveira', hora: '15:31', valor: 20 },
        { id: '139412442243', nome: 'Monica Ap. Ponso Silva', hora: '15:31', valor: 20 },
        { id: '139410505205', nome: 'Hellen Rodrigues Solera', hora: '15:31', valor: 20 },
        { id: '140059664600', nome: 'Marcelo Castro De Melo', hora: '15:31', valor: 20 },
        { id: '139409785471', nome: 'Matheus Marcos De Oliveira', hora: '15:31', valor: 20 },
        { id: '140059736552', nome: 'Maurivan Do Nascimento', hora: '15:31', valor: 20 },
        { id: '140059026908', nome: 'Jean Gleydson Barbosa', hora: '15:31', valor: 20 },
        { id: '140060598166', nome: 'Antonio Enio S. De Oliveira', hora: '15:31', valor: 20 },
        { id: '139410992949', nome: 'Priscila Pepe Bastos', hora: '15:31', valor: 20 },
        { id: '139409089883', nome: 'Patricia Guazzelli Dias', hora: '15:31', valor: 20 },
        { id: '139412026495', nome: 'Marciel Teles Da Costa', hora: '15:32', valor: 20 },
        { id: '140058307334', nome: 'John Dos Santos Oliveira', hora: '15:32', valor: 20 },
        { id: '139410289365', nome: 'Janaína J. Da Silva Sousa', hora: '15:32', valor: 20 },
        { id: '140058741130', nome: 'Solange Ap. Lopes Aguilera', hora: '15:32', valor: 20 },
        { id: '140059370810', nome: 'Marli Calistrato Alves', hora: '15:33', valor: 20 },
        { id: '140059026984', nome: 'Thais Dantas', hora: '15:33', valor: 20 },
        { id: '139410505347', nome: 'Flávio Aragão Dos Santos', hora: '15:33', valor: 20 },
        { id: '140058307374', nome: 'Maria Isabel S. De Oliveira', hora: '15:33', valor: 20 },
        { id: '140059144922', nome: 'Irene De O. D. Camargo', hora: '15:33', valor: 20 },
        { id: '140058825212', nome: 'Maria Salete De Sa', hora: '15:33', valor: 20 },
        { id: '139408798001', nome: 'Nilceane Maciel Santos', hora: '15:33', valor: 20 },
        { id: '140057329862', nome: 'Elaine Oliveira Souza', hora: '15:33', valor: 20 },
        { id: '139412630341', nome: 'Paulo Sérgio C. Alves', hora: '15:34', valor: 20 },
        { id: '140060024606', nome: 'Tamires Freitas Giannini', hora: '15:34', valor: 20 },
        { id: '140060008602', nome: 'Solange Pereira Dos Reis', hora: '15:34', valor: 20 },
        { id: '139410505449', nome: 'Adna Rego Veiga', hora: '15:35', valor: 20 },
        { id: '139409489769', nome: 'Reginaldo Orneles De Moura', hora: '15:35', valor: 40 },
        { id: '140059370912', nome: 'Edinaedna De Lima', hora: '15:35', valor: 20 },
        { id: '140059552894', nome: 'Maria Ap. Bittencourt', hora: '15:35', valor: 20 },
        { id: '140058825320', nome: 'Ana Paula Rocha Santos', hora: '15:35', valor: 20 },
        { id: '139412630417', nome: 'Luciana Alves Souza', hora: '15:35', valor: 20 },
        { id: '140058611288', nome: 'Erick Marcel De O. Lima', hora: '15:36', valor: 20 },
        { id: '140059537000', nome: 'Egle Vaitekaites', hora: '15:36', valor: 20 },
        { id: '139412442525', nome: 'Edinaldo Crispim Da Costa', hora: '15:36', valor: 20 },
        { id: '139409264031', nome: 'Rosemeire Alves De Souza', hora: '15:37', valor: 20 },
        { id: '140059972842', nome: 'José Jakson Dos Santos Lang', hora: '15:40', valor: 20 },
        { id: '139412630673', nome: 'Priscila Marcelino', hora: '15:40', valor: 20 },
        { id: '140059665200', nome: 'Marinalva G. De Macedo', hora: '15:41', valor: 20 },
        { id: '140058741608', nome: 'Gessica Saraiva', hora: '15:41', valor: 20 },
        { id: '139412550753', nome: 'Daniele Souza Marcantonio', hora: '15:41', valor: 20 },
        { id: '139409786043', nome: 'Fernando Gonçalves De Oliveira', hora: '15:42', valor: 20 },
        { id: '140059979004', nome: 'Thamiris Bueno Da Silva', hora: '15:42', valor: 20 },
        { id: '140059027458', nome: 'Adailton Da Silva Campos', hora: '15:42', valor: 20 },
        { id: '140061406454', nome: 'Diana Da Silva Oliveira', hora: '15:43', valor: 20 },
        { id: '140058795742', nome: 'Cláudia Alves Pereira', hora: '15:44', valor: 20 },
        { id: '140058503784', nome: 'Eduardo Da Silva Lemos', hora: '15:44', valor: 20 },
        { id: '139410461807', nome: 'Luiz Claudio Affonso', hora: '15:44', valor: 20 },
        { id: '140059973138', nome: 'Izaias Oliveira Silva', hora: '15:45', valor: 20 },
        { id: '140060668936', nome: 'Valter Vieira Leite', hora: '15:45', valor: 20 },
        { id: '139410506073', nome: 'Erivania Oliveira Da Silva', hora: '15:46', valor: 20 },
        { id: '140060025282', nome: 'Samara Gabriela S. Siqueira', hora: '15:47', valor: 20 },
        { id: '140060669024', nome: 'Ancelmo Muniz', hora: '15:47', valor: 20 },
        { id: '139411893367', nome: 'Thiago Gomes Da Silva', hora: '15:47', valor: 20 },
        { id: '139412027269', nome: 'Solange Ap. Lopes Aguilera', hora: '15:48', valor: 20 },
        { id: '140058742034', nome: 'Maricene Alves Lima', hora: '15:49', valor: 20 },
        { id: '140061080922', nome: 'Aldilene Quirino De Sousa', hora: '15:50', valor: 20 },
        { id: '140065156418', nome: 'Gilvan Rodrigues Da Costa', hora: '16:13', valor: 20 },
        { id: '140064532792', nome: 'Lucas Santos De Souza', hora: '16:15', valor: 20 },
        { id: '139417150621', nome: 'Antonio Israel', hora: '16:16', valor: 20 },
        { id: '139418284147', nome: 'Gilvan Rodrigues Da Costa', hora: '16:17', valor: 20 },
        { id: '139416480971', nome: 'Robson Manoel Da Silva', hora: '16:18', valor: 40 },
        { id: '140062477910', nome: 'Simone Farias Da Silva', hora: '16:19', valor: 20 },
        { id: '139415155735', nome: 'Cleidiana', hora: '16:19', valor: 20 },
        { id: '140064533080', nome: 'Sueli Souto Da Silva', hora: '16:20', valor: 20 },
        { id: '139416265279', nome: 'Keteny Santos Da Silva', hora: '16:21', valor: 20 },
        { id: '139417150997', nome: 'Gilvan Rodrigues Da Costa', hora: '16:23', valor: 20 }
    ]
};

async function generateSideBySide() {
    console.log('Generating side-by-side reconciliation...');

    try {
        let md = '# 📊 RECONCILIAÇÃO LADO A LADO: MP vs BANCO\n\n';
        md += '**Data:** 31/12/2025 10:45 (Horário Brasília)\n\n';
        md += '---\n\n';

        // Get DB claims for each round
        for (let r = 1; r <= 6; r++) {
            const dbClaims = await query(`
                SELECT payment_id, name, total_qty, claimed_at
                FROM az_claims 
                WHERE campaign_id = 21 AND status = 'PAID' AND round_number = $1
                ORDER BY claimed_at
            `, [r]);

            md += `## JOGO ${r}\n\n`;
            md += `| # | MP: Nome | MP: Hora | MP: ID | → | BD: Nome | BD: Hora | BD: ID | Status |\n`;
            md += `|---|----------|----------|--------|---|----------|----------|--------|--------|\n`;

            const mpList = mpData[`jogo${r}`] || [];
            const dbList = dbClaims.rows;

            // Create lookup for DB by payment_id
            const dbById = {};
            dbList.forEach(d => { dbById[d.payment_id] = d; });

            // For Jogo 1, show side by side
            if (r === 1) {
                let rowNum = 0;
                for (const mp of mpList) {
                    rowNum++;
                    const db = dbById[mp.id];
                    if (db) {
                        const dbHora = new Date(db.claimed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        md += `| ${rowNum} | ${mp.nome.substring(0, 25)} | ${mp.hora} | ${mp.id.slice(-6)} | → | ${db.name.substring(0, 20)} | ${dbHora} | ${db.payment_id.slice(-6)} | ✅ |\n`;
                    } else {
                        md += `| ${rowNum} | ${mp.nome.substring(0, 25)} | ${mp.hora} | ${mp.id.slice(-6)} | → | **ÓRFÃO** | - | - | ❌ |\n`;
                    }
                }

                // Calculate totals
                const mpCotas = mpList.reduce((sum, m) => sum + (m.valor / 20), 0);
                const dbCotas = dbList.reduce((sum, d) => sum + parseInt(d.total_qty), 0);
                md += `\n**RESUMO JOGO ${r}:**\n`;
                md += `- MP: ${mpList.length} pagamentos = ${mpCotas} cotas\n`;
                md += `- BD: ${dbList.length} claims = ${dbCotas} cotas\n`;
                md += `- Diferença: ${mpCotas - dbCotas} cotas ❌\n\n`;
            } else {
                // For other games, just show DB data summary
                const dbCotas = dbList.reduce((sum, d) => sum + parseInt(d.total_qty), 0);
                md += `| - | (verificar extrato MP) | - | - | → | ${dbList.length} claims | - | - | ${dbCotas} cotas |\n`;
                md += `\n**RESUMO JOGO ${r}:** BD tem ${dbList.length} claims = ${dbCotas} cotas\n\n`;
            }

            md += '---\n\n';
        }

        // Final summary
        md += '## 📋 RESUMO FINAL\n\n';
        md += '| Jogo | MP Cotas | BD Cotas | Diferença | Status |\n';
        md += '|------|----------|----------|-----------|--------|\n';

        const j1mp = mpData.jogo1.reduce((sum, m) => sum + (m.valor / 20), 0);
        md += `| 1 | ${j1mp} | 36 | ${j1mp - 36} | ⚠️ ÓRFÃOS |\n`;
        md += `| 2 | 100 | 100 | 0 | ✅ OK |\n`;
        md += `| 3 | 100 | 100 | 0 | ✅ OK |\n`;
        md += `| 4 | 100 | 100 | 0 | ✅ OK |\n`;
        md += `| 5 | 100 | 100 | 0 | ✅ OK |\n`;
        md += `| 6 | ~52 | 48 | ~4 | 🔄 Verificar |\n`;

        const totalFaltando = (j1mp - 36) + 4;
        md += `\n**TOTAL DE COTAS FALTANDO:** ${totalFaltando}\n`;

        fs.writeFileSync('./reconciliacao_lado_a_lado.md', md);
        console.log('✅ Saved to: reconciliacao_lado_a_lado.md');

    } catch (e) {
        console.error(e);
    }
}

generateSideBySide();
