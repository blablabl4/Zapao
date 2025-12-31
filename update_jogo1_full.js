const { query } = require('./src/database/db');

// Complete data for Jogo 1 (85 participants)
// Format: { paymentId, name, phone, valor }
const jogo1Data = [
    // Already in DB (35) - UPDATE these
    { id: '140050582254', nome: 'Paulo Cesar De Souza', phone: '11957186500', valor: 20 },
    { id: '139406100999', nome: 'Jéssica Batista Moreira', phone: '11954803671', valor: 20 },
    { id: '140054806722', nome: 'Renata Rodrigues', phone: '11982591171', valor: 20 },
    { id: '139410830895', nome: 'Cláudia Perez', phone: '11991236554', valor: 20 },
    { id: '140058810890', nome: 'Bruno De Oliveira Santana', phone: '11990025080', valor: 20 },
    { id: '140059665200', nome: 'Marinalva Gomes De Macedo Dias Camargo', phone: '11953896928', valor: 20 },
    { id: '140058741608', nome: 'Gessica Saraiva', phone: '11983530777', valor: 20 },
    { id: '139412550753', nome: 'Daniele Souza Marcantonio', phone: '5511977371380', valor: 20 },
    { id: '139409786043', nome: 'Fernando Gonçalves De Oliveira', phone: '11983900488', valor: 20 },
    { id: '140059979004', nome: 'Thamiris Bueno Da Silva', phone: '11954565390', valor: 20 },
    { id: '140059027458', nome: 'Adailton Da Silva Campos', phone: '11963680490', valor: 20 },
    { id: '140061406454', nome: 'Diana Da Silva Oliveira', phone: '11969896389', valor: 20 },
    { id: '140058795742', nome: 'Cláudia Alves Pereira', phone: '11980951137', valor: 20 },
    { id: '140058503784', nome: 'Eduardo Da Silva Lemos', phone: '11951790648', valor: 20 },
    { id: '139410461807', nome: 'Luiz Claudio Affonso', phone: '11975663133', valor: 20 },
    { id: '140059973138', nome: 'Izaias Oliveira Silva', phone: '11949038697', valor: 20 },
    { id: '140060668936', nome: 'Valter Vieira Leite', phone: '11949376957', valor: 20 },
    { id: '139410506073', nome: 'Erivania Oliveira Da Silva', phone: '11957068169', valor: 20 },
    { id: '140060025282', nome: 'Samara Gabriela Da Silva Siqueira', phone: '11947256956', valor: 20 },
    { id: '140060669024', nome: 'Ancelmo Muniz', phone: '11960307673', valor: 20 },
    { id: '139411893367', nome: 'Thiago Gomes Da Silva', phone: '11977331058', valor: 20 },
    { id: '139412027269', nome: 'Solange Aparecida Lopes Aguilera', phone: '11999644450', valor: 20 },
    { id: '140058742034', nome: 'Maricene Alves Lima', phone: '11955520954', valor: 20 },
    { id: '140061080922', nome: 'Aldilene Quirino De Sousa', phone: '11985300134', valor: 20 },
    { id: '140065156418', nome: 'Gilvan Rodrigues Da Costa', phone: '11983952990', valor: 20 },
    { id: '140064532792', nome: 'Lucas Santos De Souza', phone: '11952264383', valor: 20 },
    { id: '139417150621', nome: 'Antonio Israel', phone: '11943402223', valor: 20 },
    { id: '139418284147', nome: 'Gilvan Rodrigues Da Costa', phone: '11983952990', valor: 20 },
    { id: '139416480971', nome: 'Robson Manoel Da Silva', phone: '11999027345', valor: 40 },
    { id: '140062477910', nome: 'Simone Farias Da Silva', phone: '11987267764', valor: 20 },
    { id: '139415155735', nome: 'Cleidiana Cliente', phone: '11962787873', valor: 20 },
    { id: '140064533080', nome: 'Sueli Souto Da Silva', phone: '11930186164', valor: 20 },
    { id: '139416265279', nome: 'Keteny Santos Da Silva', phone: '11952561588', valor: 20 },
    { id: '139417150997', nome: 'Gilvan Rodrigues Da Costa', phone: '11983952990', valor: 20 },

    // ORPHANS (50) - CREATE these
    { id: '140054102170', nome: 'Bruno Aguiar Silva', phone: '11983947960', valor: 100, orphan: true },
    { id: '140059972312', nome: 'Rafael Da Costa Silva', phone: '11981661130', valor: 20, orphan: true },
    { id: '140058131128', nome: 'Raquel Martins Da Silva', phone: '11985010980', valor: 40, orphan: true },
    { id: '139410505139', nome: 'Geusiane Matias De Sousa', phone: '11987504433', valor: 20, orphan: true },
    { id: '139408853871', nome: 'Lilian Aparecida Barbarelli De Melo', phone: '11996150191', valor: 40, orphan: true },
    { id: '140056224096', nome: 'Gilson Menezes Da Silva', phone: '11949255449', valor: 20, orphan: true },
    { id: '139410289241', nome: 'Paula Ivaneide Ferreira Da Silva', phone: '11962088679', valor: 20, orphan: true },
    { id: '139410451163', nome: 'Janaina Leite Vieira', phone: '11984853808', valor: 20, orphan: true },
    { id: '140059902438', nome: 'Daniel Leite De Araujo', phone: '11944873619', valor: 20, orphan: true },
    { id: '140057329680', nome: 'Natanael Verdan Dos Santos', phone: '11985005275', valor: 20, orphan: true },
    { id: '139411892485', nome: 'Rosana Alves Riva', phone: '11959962644', valor: 20, orphan: true },
    { id: '140058131196', nome: 'Heffeson Souza Costa', phone: '11952551894', valor: 20, orphan: true },
    { id: '140059026868', nome: 'Marcelo Da Silva Novaes', phone: '11969150049', valor: 20, orphan: true },
    { id: '139410505197', nome: 'Érica David Rocha', phone: '11983064596', valor: 20, orphan: true },
    { id: '140057329702', nome: 'Elvis Bandeira Silveira', phone: '11956958828', valor: 20, orphan: true },
    { id: '139412442243', nome: 'Monica Aparecida Ponso Silva', phone: '11995371928', valor: 20, orphan: true },
    { id: '139410505205', nome: 'Hellen Rodrigues Solera', phone: '11963883136', valor: 20, orphan: true },
    { id: '140059664600', nome: 'Marcelo Castro De Melo', phone: '11972594502', valor: 20, orphan: true },
    { id: '139409785471', nome: 'Matheus Marcos De Oliveira', phone: '11983455545', valor: 20, orphan: true },
    { id: '140059736552', nome: 'Maurivan Do Nascimento', phone: '11961201819', valor: 20, orphan: true },
    { id: '140059026908', nome: 'Jean Gleydson Barbosa', phone: '11981288822', valor: 20, orphan: true },
    { id: '140060598166', nome: 'Antonio Enio Sebastião De Oliveira', phone: '11994561950', valor: 20, orphan: true },
    { id: '139410992949', nome: 'Priscila Pepe Bastos', phone: '11949294506', valor: 20, orphan: true },
    { id: '139409089883', nome: 'Patricia Guazzelli Dias', phone: '11930738765', valor: 20, orphan: true },
    { id: '139412026495', nome: 'Marciel Teles Da Costa', phone: '11963149754', valor: 20, orphan: true },
    { id: '140058307334', nome: 'John Dos Santos Oliveira', phone: '11968028518', valor: 20, orphan: true },
    { id: '139410289365', nome: 'Janaína José Da Silva Sousa', phone: '11981700608', valor: 20, orphan: true },
    { id: '140058741130', nome: 'Solange Aparecida Lopes Aguilera', phone: '11999644450', valor: 20, orphan: true },
    { id: '140059370810', nome: 'Marli Calistrato Alves', phone: '11963522280', valor: 20, orphan: true },
    { id: '140059026984', nome: 'Thais Dantas', phone: '11949293036', valor: 20, orphan: true },
    { id: '139410505347', nome: 'Flávio Aragão Dos Santos', phone: '11958508611', valor: 20, orphan: true },
    { id: '140058307374', nome: 'Maria Isabel Soares De Oliveira', phone: '11971422973', valor: 20, orphan: true },
    { id: '140059144922', nome: 'Irene De Oliveira Dias Camargo', phone: '11957398511', valor: 20, orphan: true },
    { id: '140058825212', nome: 'Maria Salete De Sa', phone: '11910589527', valor: 20, orphan: true },
    { id: '139408798001', nome: 'Nilceane Maciel Santos', phone: '11915621964', valor: 20, orphan: true },
    { id: '140057329862', nome: 'Elaine Oliveira Souza', phone: '11959652313', valor: 20, orphan: true },
    { id: '139412630341', nome: 'Paulo Sérgio Calistrato Alves', phone: '11933454529', valor: 20, orphan: true },
    { id: '140060024606', nome: 'Tamires Freitas Giannini', phone: '11988642779', valor: 20, orphan: true },
    { id: '140060008602', nome: 'Solange Pereira Dos Reis', phone: '11976883895', valor: 20, orphan: true },
    { id: '139410505449', nome: 'Adna Rego Veiga', phone: '11986673721', valor: 20, orphan: true },
    { id: '139409489769', nome: 'Reginaldo Orneles De Moura', phone: '11952995525', valor: 40, orphan: true },
    { id: '140059370912', nome: 'Edinaedna De Lima', phone: '11960372873', valor: 20, orphan: true },
    { id: '140059552894', nome: 'Maria Aparecida Bittencourt', phone: '11978619331', valor: 20, orphan: true },
    { id: '140058825320', nome: 'Ana Paula Rocha Santos', phone: '11959924507', valor: 20, orphan: true },
    { id: '139412630417', nome: 'Luciana Alves Souza', phone: '11979516121', valor: 20, orphan: true },
    { id: '140058611288', nome: 'Erick Marcel De Oliveira Lima', phone: '11951000884', valor: 20, orphan: true },
    { id: '140059537000', nome: 'Egle Vaitekaites', phone: '11981731786', valor: 20, orphan: true },
    { id: '139412442525', nome: 'Edinaldo Crispim Da Costa', phone: '5511981426343', valor: 20, orphan: true },
    { id: '139409264031', nome: 'Rosemeire Alves De Souza', phone: '19999998607', valor: 20, orphan: true },
    { id: '140059972842', nome: 'José Jakson Dos Santos Lang', phone: '11957870635', valor: 20, orphan: true },
    { id: '139412630673', nome: 'Priscila Marcelino', phone: '11986856552', valor: 20, orphan: true },
];

async function updateJogo1() {
    console.log('=== ATUALIZANDO JOGO 1 COM DADOS REAIS ===\n');

    let updated = 0, created = 0, errors = 0;

    try {
        for (const p of jogo1Data) {
            const cotas = p.valor / 20;

            if (p.orphan) {
                // CREATE new claim for orphan
                try {
                    await query(`
                        INSERT INTO az_claims (
                            campaign_id, round_number, name, phone, payment_id, 
                            status, total_qty, base_qty, extra_qty, type, 
                            next_unlock_at, expires_at, claimed_at
                        ) VALUES (
                            21, 1, $1, $2, $3, 'PAID', $4, $4, 0, 'RECOVERY', 
                            NOW(), NOW() + INTERVAL '1 year', NOW()
                        )
                    `, [p.nome, p.phone, p.id, cotas]);
                    created++;
                    console.log(`✅ CRIADO: ${p.nome} (${cotas} cotas)`);
                } catch (e) {
                    console.error(`❌ Erro criando ${p.nome}: ${e.message}`);
                    errors++;
                }
            } else {
                // UPDATE existing claim
                try {
                    const res = await query(`
                        UPDATE az_claims 
                        SET name = $1, phone = $2, total_qty = $3
                        WHERE payment_id = $4 AND campaign_id = 21
                        RETURNING id
                    `, [p.nome, p.phone, cotas, p.id]);

                    if (res.rowCount > 0) {
                        updated++;
                        console.log(`✅ ATUALIZADO: ${p.nome}`);
                    } else {
                        console.log(`⚠️ Não encontrado para atualizar: ${p.id}`);
                    }
                } catch (e) {
                    console.error(`❌ Erro atualizando ${p.nome}: ${e.message}`);
                    errors++;
                }
            }
        }

        console.log(`\n=== RESUMO ===`);
        console.log(`Atualizados: ${updated}`);
        console.log(`Criados: ${created}`);
        console.log(`Erros: ${errors}`);
        console.log(`Total processado: ${updated + created}`);

    } catch (e) {
        console.error('Erro geral:', e);
    }
}

updateJogo1();
