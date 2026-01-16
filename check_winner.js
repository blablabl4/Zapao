/**
 * Script para verificar se um telefone ganhou alguma rifa
 * Uso: railway run node check_winner.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const phone = '11987873164';

async function checkWinner() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        console.log(`\n🔍 Verificando telefone: ${phone}\n`);

        // 1. Buscar todas as compras deste telefone
        const ordersRes = await pool.query(`
            SELECT o.*, d.draw_name, d.drawn_number, d.status as draw_status, d.payout_each
            FROM orders o
            JOIN draws d ON o.draw_id = d.id
            WHERE o.buyer_ref LIKE '%${phone}%'
            ORDER BY o.created_at DESC
        `);

        console.log(`📋 Total de compras encontradas: ${ordersRes.rows.length}\n`);

        // 2. Verificar se ganhou alguma
        let hasWon = false;
        for (const order of ordersRes.rows) {
            const isWinner = order.status === 'PAID' &&
                order.draw_status === 'CLOSED' &&
                order.number === order.drawn_number;

            if (isWinner) {
                hasWon = true;
                const buyerParts = order.buyer_ref.split('|');
                console.log('🏆 ========== GANHADOR ENCONTRADO ==========');
                console.log(`   Rifa: ${order.draw_name}`);
                console.log(`   Número sorteado: ${order.drawn_number}`);
                console.log(`   Número comprado: ${order.number}`);
                console.log(`   Nome: ${buyerParts[0] || 'N/A'}`);
                console.log(`   Telefone: ${buyerParts[1] || phone}`);
                console.log(`   Prêmio: R$ ${parseFloat(order.payout_each || 0).toFixed(2)}`);
                console.log(`   Order ID: ${order.order_id}`);
                console.log(`   Data compra: ${order.created_at}`);
                console.log('============================================\n');
            }
        }

        if (!hasWon) {
            console.log('❌ Este telefone NÃO ganhou nenhuma rifa.\n');
        }

        // 3. Mostrar resumo de todas as compras
        console.log('📊 Resumo de compras:');
        for (const order of ordersRes.rows) {
            const buyerParts = order.buyer_ref.split('|');
            console.log(`   - Rifa: ${order.draw_name} | Nº ${order.number} | Status: ${order.status} | ${buyerParts[0]}`);
        }

        // 4. Verificar pagamentos de ganhadores (se existir)
        const winnerPayments = await pool.query(`
            SELECT wp.*, o.buyer_ref
            FROM winner_payments wp
            JOIN orders o ON wp.order_id = o.order_id
            WHERE o.buyer_ref LIKE '%${phone}%'
        `);

        if (winnerPayments.rows.length > 0) {
            console.log('\n💰 Pagamentos de prêmio registrados:');
            for (const payment of winnerPayments.rows) {
                console.log(`   - R$ ${parseFloat(payment.amount).toFixed(2)} via ${payment.payment_method} em ${payment.created_at}`);
            }
        } else {
            console.log('\n💰 Nenhum pagamento de prêmio registrado para este telefone.');
        }

    } catch (e) {
        console.error('Erro:', e.message);
    } finally {
        await pool.end();
    }
}

checkWinner();
