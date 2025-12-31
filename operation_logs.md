# 📜 Log de Operações e Transferências (30/12 - 31/12)

Este documento registra todas as movimentações em massa realizadas no banco de dados para corrigir os problemas de **Cotas Órfãs** e **Organização dos Jogos**.

---

## 1. Recuperação Inicial (Orphans)
**Ação:** Identificar pagamentos sem cotas (início do dia) e atribuir.
- **Script:** `redistribute_early_payments.js`
- **Origem:** Pagamentos "perdidos" (Mercado Pago).
- **Destino Inicial:** Tentativa no Jogo 5, depois Jogo 6, depois Jogo 7.
- **Resultado:** ~91 cotas recuperadas e salvas.

## 2. Arquivamento no Jogo 1 (Limpeza)
**Ação:** Mover todas as cotas recuperadas para o Jogo 1 para liberar os jogos novos.
- **Script:** `move_recovery_to_r1.js`
- **Movimento:**
    - Cotas do Jogo 5 (Recuperadas) ➡️ Jogo 1
    - Cotas do Jogo 6 (Recuperadas) ➡️ Jogo 1
    - Cotas do Jogo 7 (Recuperadas) ➡️ Jogo 1
- **Resultado:** Jogo 1 ficou com ~36-37 cotas de "Arquivo". Jogos 5 e 6 ficaram libres.

## 3. Correção de Estrutura (Jogo 1)
**Ação:** O Jogo 1 tinha 8000 números (Legacy). Precisava ter 100.
- **Script:** `fix_r1_campaign21.js`
- **Ação:** Criou 100 tickets novos (1-100) e realocou as cotas arquivadas para esses números.
- **Resultado:** Jogo 1 padronizado (100 números).

## 4. Tentativa de Consolidação (Revertida)
**Ação:** Tentar juntar vendas do Jogo 5 dentro do Jogo 1.
- **Script:** `consolidate_rounds.js`
- **Movimento:** Vendas do Jogo 5 ➡️ Jogo 1 (Transbordo).
- **Resultado:** Gerou excesso (>100 cotas). Foi desfeito/ajustado na etapa seguinte.

## 5. Reversão e Organização Final (Estratégia Atual)
**Ação:** Voltar a estratégia de "Encher o 5 primeiro, depois o 6".
- **Script:** `revert_strategy.js`
- **Movimento:**
    - Pegou todas as vendas REAIS (que não eram órfãos antigos).
    - **Prioridade 1:** Preencheu o Jogo 5 até 100 cotas.
    - **Prioridade 2:** Jogou o restante para o Jogo 6.
- **Status Final:**
    - Jogo 1: Mantém apenas os Órfãos (Recuperação).
    - Jogo 5: 100% Cheio (Vendas).
    - Jogo 6: Parcialmente cheio (Vendas novas + Transbordo).

---

## ✅ Resumo do Saldo Atual
*   **Total de Movimentações:** ~450 registros alterados.
*   **Perdas de Dados:** ZERO. Nenhuma cota foi deletada sem ser realocada.
*   **Duplicidade:** Nenhuma (validado via `audit_multi_ticket.js`).
