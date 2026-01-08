# Documentação Completa: Zapão da Sorte - Mecânica e Regras

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Mecânica do Jogo](#mecânica-do-jogo)
3. [Fluxo do Usuário](#fluxo-do-usuário)
4. [Sistema de Sorteio](#sistema-de-sorteio)
5. [Sistema de Pagamentos](#sistema-de-pagamentos)
6. [Regras Gerais](#regras-gerais)
7. [Sistema de Afiliados](#sistema-de-afiliados)
8. [Dados Financeiros](#dados-financeiros)
9. [Arquitetura Técnica](#arquitetura-técnica)

---

## Visão Geral

**Nome**: Zapão da Sorte  
**Tipo**: Rifa online com sorteio automatizado  
**Modelo**: Venda de cotas numeradas com prêmio garantido  
**Plataforma**: Web (responsivo mobile/desktop)  
**Intervalo de Números**: 0 a 99 (100 números por sorteio)  
**Preço por Número**: R$ 1,50  
**Prêmio Base**: R$ 100,00 (configurável)  

### Dados de Desempenho (Jan 2-8, 2026)
- **Receita Total**: R$ 12.531,00 (7 dias)
- **Total de Pedidos**: 8.354
- **Compradores Únicos**: 1.575
- **Run Rate Mensal**: ~R$ 50.000,00
- **Base Ativa**: 200-300 usuários
- **Base Fria**: 45.000 contatos

---

## Mecânica do Jogo

### Estrutura Básica
1. **Capacidade por Sorteio**: 100 números (00 a 99)
2. **Compra Múltipla**: Permitida (ilimitada)
3. **Duplicação**: PERMITIDA - múltiplos usuários podem comprar o mesmo número
4. **Janela de Tempo**: 1 hora padrão (configurável pelo admin)

### Modelo de Premiação
- **Prêmio Garantido**: R$ 100,00 (base)
- **Sistema de Reserva**: Acumula margem para sorteios futuros
- **Winners Count**: Variável (pode ter múltiplos ganhadores se número duplicado)
- **Payout**: Dividido igualmente entre todos que compraram o número sorteado

### Exemplo de Cenário
```
Número sorteado: 42
Compradores do 42: João, Maria, Pedro
Prêmio: R$ 100,00
Payout cada: R$ 33,33
```

---

## Fluxo do Usuário

### 1. Acesso ao Site
**URL**: `tvzapao.com.br/zapao-da-sorte`

**Primeira Tela:**
- Logo/Banner da campanha
- Valor do prêmio atual (destaque)
- Subtitle: "Escolha um número de 00 a 99 e concorra!"
- Timer de contagem regressiva
- Grid de 100 números (00-99)

### 2. Seleção de Números
**Interface:**
- Grid 5 colunas (responsivo)
- Números formatados com zero à esquerda (00, 01, ..., 99)
- Visual feedback:
  - **Disponível**: Botão padrão
  - **Selecionado**: Destacado com cor (interativo)
  - **Já Vendido**: Marcado (mas clicável - pode duplicar)

**Comportamento:**
- Clique toggle (seleciona/desseleciona)
- Múltipla seleção permitida
- Floating button aparece com resumo: "🛒 Comprar X (R$ Y.YY)"

### 3. Checkout
**Modal de Pagamento** (abre ao clicar no botão flutuante)

**Etapa 1 - Dados do Comprador:**
```
- Nome completo
- Telefone (máscara automática)
- Data de nascimento (validação 18+)
- Gênero (opcional)
```

**Etapa 2 - Geração do Pix:**
- Sistema gera QR Code único
- Valor total: `números_selecionados * R$ 1,50`
- Timer de expiração: 15 minutos
- Opção "Copiar código Pix"

**Etapa 3 - Aguardando Pagamento:**
- Polling automático (verifica status a cada 10s)
- Notificação em tempo real quando pago
- Transição automática para tela de sucesso

**Etapa 4 - Confirmação:**
- "✅ Pagamento confirmado!"
- Números adquiridos listados
- Botão "Comprar mais números"

### 4. Acompanhamento
**Página "Meus Números":**
- Login via telefone
- Lista de todos os números comprados no sorteio atual
- Status de pagamento
- Data/hora da compra

---

## Sistema de Sorteio

### Tipos de Sorteio

#### 1. Sorteio Manual (Admin)
**Processo:**
1. Admin acessa painel `/admin-zapao.html`
2. Clica em "Encerrar Sorteio"
3. Escolhe método:
   - **Manual**: Digita número específico (0-99)
   - **Visual Roulette**: Roleta 3D com animação

#### 2. Sorteio Automático (Weighted Draw)
**Algoritmo:**
```javascript
// Sistema de pesos:
- Top 30% mais vendidos: +30% de chance
- Números sem venda: peso 1 (baseline)
- Sistema gera número balanceado

Exemplo:
Número 42: 50 vendas → peso 65 (1 + 30% * vendas normalizadas)
Número 07: 0 vendas → peso 1
```

**Arquivo**: `DrawService.js` → `getWeightedDrawResult(drawId)`

**Mecânica:**
1. Busca total de vendas por número
2. Calcula pesos proporcionais
3. Gera array expandido com repetições
4. Sorteia aleatoriamente do array ponderado

### Finalização do Sorteio

**Quando ocorre:**
- Manual: Quando admin clica "Encerrar"
- Automático: Ao atingir `end_time` configurado

**Ações ao fechar:**
1. Marcar draw como `CLOSED`
2. Registrar `drawn_number`
3. Identificar ganhadores (query orders WHERE number = drawn_number AND status = 'PAID')
4. Calcular `payout_each` = prize / winners_count
5. Notificar ganhadores (futuro: implementar)
6. Liberar reserva para próximo sorteio

---

## Sistema de Pagamentos

### Provedores Integrados
1. **Mercado Pago** (principal)
2. **InfinitePay** (fallback)

**Estratégia:**
- Tenta Mercado Pago primeiro
- Se falhar, usa InfinitePay
- `PaymentHub` gerencia fallback automático

### Fluxo de Pagamento

#### Criação do Pedido
**Endpoint**: `POST /api/orders/bulk`

**Payload:**
```json
{
  "numbers": [0, 5, 10, 99],
  "buyer_ref": "João Silva|11998765432|1990-01-15|M",
  "referrer_id": "AFF123" // opcional
}
```

**Resposta:**
```json
{
  "orders": [
    { "order_id": "ORD-001", "number": 0, "amount": 1.50, "status": "PENDING" },
    ...
  ],
  "totalAmount": 6.00,
  "qr_image_data_url": "data:image/png;base64,...",
  "pix_copy_paste": "00020126...",
  "expires_at": "2026-01-08T12:30:00Z",
  "primary_order_id": "ORD-001"
}
```

#### Webhook de Confirmação
**Endpoint**: `POST /api/webhooks/mercadopago` ou `/infinitepay`

**Ações:**
1. Valida assinatura do webhook
2. Extrai `order_id` e `amount_paid`
3. Atualiza status: `PENDING` → `PAID`
4. Registra em `payments` table
5. Frontend detecta mudança via polling

#### Status de Pedido
- **PENDING**: Aguardando pagamento
- **PAID**: Confirmado
- **EXPIRED**: Não pago dentro de 15min

### Anti-Fraude

**Regra 1: Bloqueio de Duplicatas (60s)**
```
Se um telefone já tem pedido PENDING nos últimos 60s:
→ Retorna erro 429
→ Impede spam de pedidos
```

**Regra 2: Validação de Números**
```
Backend valida:
- isNaN(number) → Rejeita
- number < 0 → Rejeita  
- number >= 100 → Rejeita
```

---

## Regras Gerais

### Para Usuários

**✅ PERMITIDO:**
- Comprar múltiplos números em uma transação
- Comprar números já vendidos (duplicação)
- Comprar quantos números quiser (sem limite)
- Pagar via Pix (única forma de pagamento)

**❌ NÃO PERMITIDO:**
- Comprar após `sales_locked` = true
- Comprar números fora do range 0-99
- Fazer múltiplos pedidos do mesmo telefone em <60s

### Para Administradores

**Controles Disponíveis:**
1. **Criar Nova Rifa**: Define nome, prêmio, data/hora de encerramento
2. **Pausar Vendas**: `sales_locked` = true (emergência)
3. **Editar Horário**: Altera `end_time` da rifa ativa
4. **Visualizar Vendas**: Lista todos os pedidos (pagos/pendentes)
5. **Ver Ranking**: Top números mais vendidos
6. **Sortear**: Manual ou via roleta visual
7. **Histórico**: Ver todos os sorteios passados

### Regras de Negócio

**1. Margem de Lucro:**
```
Receita por sorteio: números_vendidos * R$ 1,50
Prêmio fixo: R$ 100,00
Margem atual: ~11% (baixa)

Cenário ideal (ajuste futuro):
- Ticket: R$ 5,00
- Prêmio: R$ 100,00
- Break-even: 20 números
- Margem com 50 vendas: 60%
```

**2. Reserva Financeira:**
```sql
reserve_amount = (receita_total - prêmio_base) * 0.1
```
- 10% da margem vai para reserva
- Usado para prêmios futuros ou emergências

**3. Ciclo de Sorteios:**
- **Intervalo**: 1 hora (padrão)
- **Frequência**: 24 sorteios/dia (potencial)
- **Atual**: ~2-3 sorteios/dia (manual)

---

## Sistema de Afiliados

### Mecânica

**Cadastro de Afiliado:**
- Admin cria código único: `AFF-NOME`
- Gera link: `tvzapao.com.br/zapao-da-sorte?ref=AFF-NOME`

**Tracking:**
```javascript
// Frontend captura ref= do URL
localStorage.setItem('affiliateData', JSON.stringify({
  code: 'AFF-NOME',
  drawId: current_draw.id
}));

// Persiste até compra
// Backend registra referrer_id no pedido
```

**Comissão:**
- Armazenada em `orders.referrer_id`
- Admin vê relatório em `/admin-zapao.html` → Tab Afiliados
- Pagamento: Manual (fora do sistema)

### Estatísticas de Afiliado
**Endpoint**: `GET /api/admin/affiliate-stats`

**Métricas:**
- Total de vendas geradas
- Receita atribuída
- Ranking de afiliados
- Cliques vs Conversões

---

## Dados Financeiros

### Métricas Reais (Jan 2-8, 2026)

**Receita:**
- Total 7 dias: R$ 12.531,00
- Média/dia: R$ 1.790,14
- Run rate mensal: R$ 50.000,00

**Volume:**
- Total pedidos: 8.354
- Compradores únicos: 1.575
- Ticket médio: R$ 7,95 (5-6 números por compra)

**Análise de Lucratividade:**
```
Cenário atual (R$ 1,50/número, R$ 100,00 prêmio):
- Break-even: 67 números vendidos
- Margem com 75 vendas: 11%
- Margem com 100 vendas: 33%

Cenário proposto (R$ 5,00/número):
- Break-even: 20 números vendidos
- Margem com 50 vendas: 60%
- Margem com 100 vendas: 80%
```

### KPIs Importantes
1. **Taxa de Conversão**: 1.575 / 45.000 = 3,5% (base fria)
2. **Retenção**: 200-300 ativos (13-19% dos convertidos)
3. **LTV**: Ainda não medido (implementar)
4. **CAC**: R$ 0 (base orgânica do tio)

---

## Arquitetura Técnica

### Stack
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Hosting**: Railway (Hobby tier)
- **Frontend**: HTML/CSS/JS vanilla
- **Pagamentos**: Mercado Pago + InfinitePay

### Estrutura de Dados

**Tabela: draws**
```sql
- id (serial)
- draw_name (text)
- prize_base (numeric) - prêmio garantido
- reserve_amount (numeric) - reserva acumulada
- current_prize (computed) - base + reserve
- total_numbers (integer) - 100
- start_time (timestamp)
- end_time (timestamp)
- status (text) - ACTIVE | CLOSED | PAUSED
- sales_locked (boolean)
- drawn_number (integer) - null até sorteio
- winners_count (integer)
- payout_each (numeric)
```

**Tabela: orders**
```sql
- order_id (text, PK)
- draw_id (integer, FK)
- number (integer) - 0 a 99
- buyer_ref (text) - "Nome|Telefone|Nascimento|Gênero"
- referrer_id (text) - código afiliado
- amount (numeric) - 1.50
- status (text) - PENDING | PAID | EXPIRED
- created_at (timestamp)
- expires_at (timestamp)
```

**Tabela: payments**
```sql
- id (serial)
- order_id (text, FK)
- txid (text) - ID da transação no gateway
- amount_paid (numeric)
- paid_at (timestamp)
- provider (text) - mercadopago | infinitepay
```

### APIs Principais

**Públicas:**
- `GET /api/orders/stats/global` - Estatísticas do sorteio
- `POST /api/orders/bulk` - Criar múltiplos pedidos
- `GET /api/orders/:orderId` - Status de pedido
- `GET /api/orders/my-numbers/:phone` - Números do usuário

**Admin:**
- `POST /api/admin/start-draw` - Criar nova rifa
- `POST /api/admin/close-draw` - Finalizar e sortear
- `GET /api/admin/draw-secret` - Número ponderado (weighted)
- `GET /api/admin/ranking` - Top números vendidos
- `POST /api/admin/toggle-sales` - Pausar/liberar vendas

---

## Pontos de Atenção Estratégica

### Oportunidades
1. **Aumentar Ticket**: R$ 1,50 → R$ 5,00 (+233% margem)
2. **Automatizar Sorteios**: 1 a cada hora = 24x volume
3. **Reativar Base Fria**: 45k contatos não explorados
4. **Gamificação**: Badges, streaks, bônus de fidelidade
5. **Sorteios Especiais**: Prêmios maiores em horários nobres

### Desafios
1. **Margem Baixa**: 11% é insustentável a longo prazo
2. **Operação Manual**: Dependência de admin para sorteios
3. **Monitoramento**: Falta dashboard de métricas em tempo real
4. **Notificações**: Ganhadores não são notificados automaticamente
5. **Diversificação**: Único produto (risco de saturação)

### Riscos
1. **Duplicação Excessiva**: Muitos ganhadores = prêmio diluído
2. **Capacidade Ociosa**: Sorteios com <30 vendas = prejuízo
3. **Fraude/Spam**: Sistema aceita ilimitados por usuário
4. **Concorrência**: Fácil copiar o modelo

---

## Próximos Passos Recomendados

**Curto Prazo (1-2 semanas):**
1. Ajustar pricing para R$ 5,00/número
2. Implementar sorteios automáticos a cada hora
3. Dashboard de métricas em tempo real
4. Sistema de notificações (WhatsApp/SMS)

**Médio Prazo (1-2 meses):**
1. Campanha de reativação da base fria
2. Programa de fidelidade
3. App mobile (PWA)
4. Diversificação: rifas temáticas, prêmios variados

**Longo Prazo (3-6 meses):**
1. Marketplace de rifas (terceiros)
2. Sistema de créditos/cashback
3. Gamificação completa
4. Expansão para outras regiões

---

**Documento gerado em**: 2026-01-08  
**Versão**: 1.0  
**Sistema**: Zapão da Sorte com intervalo 0-99
