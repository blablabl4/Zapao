/**
 * Script para limpar TODOS os dados do projeto "Amigos do Zapão"
 * Mantém isolamento - NÃO afeta outros sistemas do workspace
 * 
 * Tabelas afetadas (prefixo az_):
 * - az_tickets (números/participantes)
 * - az_claims (resgates)
 * - az_promo_redemptions (resgates de promo)
 * - az_promo_tokens (tokens de promo)
 * - az_promotions (promoções)
 * - az_events (logs do sistema)
 * - az_whitelist (lista branca)
 * - az_campaigns (campanhas - RESET para estado inicial)
 * 
 * NÃO AFETADAS:
 * - orders, payments, draws (Rifa principal)
 * - affiliates, affiliate_clicks (Afiliados)
 * - scratchcards, scratch_* (Raspadinha)
 * - az_bolao_* (Bolão)
 * - hub_*, leads (Hub)
 * - admin_users, session (Auth)
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function cleanAmigosData() {
    console.log('🔄 Iniciando limpeza dos dados do Amigos do Zapão...');
    console.log('⚠️  ATENÇÃO: Isso vai apagar TODOS os dados de ganhadores, tickets e participantes!\n');

    try {
        // Ordem de deleção respeitando foreign keys
        const cleanupQueries = [
            { name: 'az_promo_redemptions', sql: 'DELETE FROM az_promo_redemptions' },
            { name: 'az_promo_tokens', sql: 'DELETE FROM az_promo_tokens' },
            { name: 'az_promotions', sql: 'DELETE FROM az_promotions' },
            { name: 'az_claims', sql: 'DELETE FROM az_claims' },
            { name: 'az_tickets', sql: 'DELETE FROM az_tickets' },
            { name: 'az_events', sql: 'DELETE FROM az_events' },
            { name: 'az_whitelist', sql: 'DELETE FROM az_whitelist' },
        ];

        for (const query of cleanupQueries) {
            try {
                const result = await pool.query(query.sql);
                console.log(`✅ ${query.name}: ${result.rowCount} registros removidos`);
            } catch (err) {
                // Table might not exist
                if (err.code === '42P01') {
                    console.log(`⏭️  ${query.name}: tabela não existe (skip)`);
                } else {
                    console.log(`⚠️  ${query.name}: ${err.message}`);
                }
            }
        }

        // Reset da campanha (mantém a campanha mas limpa house_winner)
        try {
            const resetCampaign = await pool.query(`
                UPDATE az_campaigns 
                SET house_winner_enabled = false,
                    house_winner_number = NULL,
                    house_winner_name = NULL,
                    current_round = 1
            `);
            console.log(`✅ az_campaigns: ${resetCampaign.rowCount} campanha(s) resetada(s)`);
        } catch (err) {
            console.log(`⚠️  az_campaigns reset: ${err.message}`);
        }

        console.log('\n🎉 Limpeza concluída! O sistema está pronto para novos dados.');
        console.log('📌 Próximos passos:');
        console.log('   1. Configure uma nova campanha no admin');
        console.log('   2. Adicione a whitelist de participantes');
        console.log('   3. Inicie a distribuição de números');

    } catch (err) {
        console.error('❌ Erro fatal:', err.message);
    } finally {
        await pool.end();
    }
}

cleanAmigosData();
