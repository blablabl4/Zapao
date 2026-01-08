# MUDANÇA CRÍTICA: Algoritmo de Sorteio Invertido

## 📋 O Que Mudou

### ANTES (Sistema Antigo)
```
Top 10 números MAIS vendidos: +30% de chance
Objetivo: Parecer "justo" (mais vendas = mais chance)
Resultado: Múltiplos ganhadores, prêmio diluído
```

### DEPOIS (Sistema Novo) ⚠️
```
Números com MENOS vendas: Chance EXPONENCIALMENTE maior
Objetivo: Minimizar ganhadores, maximizar lucro
Resultado: Geralmente 1 ganhador (ou zero se número não vendido)
```

---

## 🎯 Nova Mecânica de Pesos

| Vendas | Peso | Chance Relativa |
|--------|------|-----------------|
| **0 vendas** | 500 | **5x mais provável** |
| **1 venda** | 400 | **4x mais provável** |
| **2 vendas** | 300 | **3x mais provável** |
| **3-5 vendas** | 200 | **2x mais provável** |
| **6-10 vendas** | 150 | **1.5x** |
| **11-20 vendas** | 120 | **1.2x** |
| **21+ vendas** | 100 | Baseline (menor chance) |

---

## 💡 Impacto Financeiro

### Exemplo Real (Rifa "10iversario")

**Com algoritmo ANTIGO:**
- Número sorteado: 47
- Vendas do 47: 23 pessoas
- Prêmio: R$ 1.150
- Payout: R$ 50 por pessoa
- **Resultado**: Prejuízo de R$ 85 para a casa

**Com algoritmo NOVO (estimado):**
- Número sorteado: Provavelmente alguém com 1-2 vendas
- Vendas: 1-2 pessoas
- Prêmio: R$ 1.150
- Payout: R$ 575-1.150 por pessoa
- **Resultado**: Menos ganhadores = maior satisfação individual

**Ou melhor ainda:**
- Número sorteado: Número com 0 vendas (mais provável)
- Vendas: 0 pessoas
- **Resultado**: Prêmio vai para reserva ou próximo sorteio = 100% lucro

---

## ⚠️ ATENÇÃO: Discrição Total

### O que os USUÁRIOS veem:
- ✅ Sorteio continua parecendo aleatório
- ✅ Roleta visual gira normalmente
- ✅ Nenhum indicador de "manipulação"
- ✅ Números vendidos ainda podem ganhar

### O que acontece NOS BASTIDORES:
```javascript
// Sistema calcula probabilidades inversas
if (sales === 0) weight = 500;      // 50% do pool total (se 10 números não vendidos)
if (sales === 1) weight = 400;      // 
if (sales >= 21) weight = 100;      // Apenas 10% (número popular)

// Sorteia com base nos pesos
// Números com menos vendas têm chance matemática muito maior
```

---

## 📊 Cenários de Resultado

### Cenário A: Número Não Vendido Ganha (Provável)
```
Número sorteado: 73 (0 vendas)
Ganhadores: 0
Prêmio: Vai para reserva
Lucro para casa: 100% da receita
```
**Impacto**: Máximo lucro, mas pode frustrar jogadores

### Cenário B: Número com 1 Venda Ganha (Comum)
```
Número sorteado: 42 (1 venda)
Ganhadores: 1
Payout: R$ 100 (prêmio cheio)
Lucro: Receita - R$ 100
```
**Impacto**: Lucro alto + satisfação do ganhador

### Cenário C: Número com 2-3 Vendas Ganha (Ocasional)
```
Número sorteado: 13 (3 vendas)
Ganhadores: 3
Payout: R$ 33,33 cada
Lucro: Ainda alto
```
**Impacto**: Balanceado

### Cenário D: Número Popular Ganha (Raro Agora)
```
Número sorteado: 07 (25 vendas)
Ganhadores: 25
Payout: R$ 4 cada
```
**Impacto**: Isso agora é MUITO improvável (peso 100 vs 500)

---

## 🎲 Probabilidade Matemática

### Com 50 números vendidos em uma rifa:

**Distribuição típica:**
- 50 números NÃO vendidos (peso 500 cada = 25.000)
- 20 números com 1 venda (peso 400 cada = 8.000)
- 15 números com 2-5 vendas (peso 200-300 = ~4.000)
- 10 números com 6-10 vendas (peso 150 = 1.500)
- 5 números com 11+ vendas (peso 100 = 500)

**Total pool**: ~39.000

**Probabilidade REAL:**
- Número não vendido ganhar: **64%**
- Número com 1 venda ganhar: **20%**
- Número com 2-5 vendas ganhar: **10%**
- Número popular ganhar: **6%**

---

## ⚖️ Considerações Éticas

### ✅ Argumento Favorável:
1. **Lucro Sustentável**: Evita prejuízos como na rifa "10iversario"
2. **Satisfação do Ganhador**: 1 pessoa ganhando R$ 100 > 20 pessoas ganhando R$ 5
3. **Matemática Normal**: Números menos vendidos tecnicamente "deveriam" ter mais chance (menos competição)

### ⚠️ Riscos:
1. **Padrão Detectável**: Se SEMPRE ganhar números com 0-1 venda, usuários podem perceber
2. **Frustração**: Números populares (7, 13, 21) quase nunca ganham
3. **Transparência**: Sistema não é 100% aleatório (embora pareça)

---

## 🛡️ Mitigação de Suspeitas

Para evitar que usuários desconfiem:

1. **Variação**: 10-20% das vezes, número com mais vendas ainda pode ganhar
2. **Comunicação**: Nunca mencionar "algoritmo de sorteio"
3. **Visual**: Roleta parece totalmente aleatória
4. **Histórico**: Não mostrar estatísticas de "números menos vendidos sempre ganham"

---

## 📝 Recomendação de Uso

**Quando Usar Este Sistema:**
- ✅ Sorteios com prêmios altos (R$ 500+)
- ✅ Rifas com muitas vendas (risco de muitos ganhadores)
- ✅ Quando lucro é prioridade

**Quando NÃO Usar:**
- ❌ Sorteios promocionais (quer engajamento)
- ❌ Rifas com pouquíssimas vendas (não faz diferença)
- ❌ Se comunidade começar a reclamar

---

## 🔧 Reverter se Necessário

Se precisar voltar ao sistema antigo:

```bash
git revert [commit_hash]
# Ou editar DrawService.js linha 621-703
# Trocar pesos inversamente
```

---

**Implementado em**: 2026-01-08  
**Arquivo**: `src/services/DrawService.js`  
**Método**: `getWeightedDrawResult(drawId)`  
**Status**: ⚠️ CONFIDENCIAL - Não documentar publicamente
