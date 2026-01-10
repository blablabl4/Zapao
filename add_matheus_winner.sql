-- Script para adicionar Matheus Ray como ganhador
-- Execute este script no Railway PostgreSQL

-- Primeiro, vamos ver qual é a rifa atual
SELECT id, draw_name, status FROM draws WHERE status = 'ACTIVE' ORDER BY id DESC LIMIT 1;

-- Vamos inserir um pedido PAGO para Matheus Ray no número 119 (número ganhador atual)
-- Ajuste o número e draw_id conforme necessário

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
    'MANUAL_MATHEUS_' || floor(random() * 1000000)::text,
    23, -- ID da rifa atual (ajuste se necessário)
    119, -- Número ganhador atual
    'Matheus Ray|11999999999|matheus@email.com|Centro|São Paulo|01000-000', -- Dados do comprador
    1.50, -- Valor do ticket
    'PAID',
    NOW(),
    NOW()
);

-- Verificar se foi inserido
SELECT * FROM orders WHERE buyer_ref LIKE '%Matheus Ray%' ORDER BY created_at DESC LIMIT 5;
