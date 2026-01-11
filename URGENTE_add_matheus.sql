-- ============================================
-- SCRIPT URGENTE: Adicionar Matheus Ray como Ganhador
-- Execute este SQL diretamente no console do PostgreSQL no Railway
-- ============================================

-- PASSO 1: Verificar a rifa atual e número ganhador
SELECT 
    id as draw_id, 
    draw_name, 
    status 
FROM draws 
WHERE status = 'ACTIVE' 
ORDER BY id DESC 
LIMIT 1;

-- Resultado esperado: draw_id = 23, número ganhador atual = 119

-- PASSO 2: Inserir pedido PAGO para Matheus Ray
INSERT INTO orders (
    order_id,
    draw_id,
    number,
    buyer_ref,
    amount,
    status,
    created_at,
    paid_at
) VALUES (
    'MANUAL_MATHEUS_RAY_' || extract(epoch from now())::text,
    23, -- ID da rifa #18 (ativa)
    119, -- Número ganhador
    'Matheus Ray|11987654321|matheus.ray@email.com|Centro|São Paulo|01000-000',
    1.50,
    'PAID',
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- PASSO 3: Verificar se foi inserido
SELECT 
    order_id,
    draw_id,
    number,
    split_part(buyer_ref, '|', 1) as nome,
    split_part(buyer_ref, '|', 4) as bairro,
    status,
    created_at
FROM orders 
WHERE buyer_ref LIKE '%Matheus Ray%' 
ORDER BY created_at DESC 
LIMIT 3;

-- ============================================
-- INSTRUÇÕES:
-- 1. Acesse: https://railway.app/project/[seu-projeto]/service/[database]
-- 2. Vá em "Data" > "Query"
-- 3. Cole o SQL acima
-- 4. Execute
-- 5. Matheus Ray aparecerá como ganhador na roleta!
-- ============================================
