-- ============================================
-- COMISSÃO TOTAL - Marcos Luis de Sousa Pereira
-- Execute no Railway PostgreSQL
-- ============================================

-- PASSO 1: Encontrar o telefone/código de afiliado
SELECT 
    phone as telefone,
    name as nome,
    referrer_code as codigo
FROM affiliates 
WHERE name ILIKE '%Marcos%' 
  AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
  AND (name ILIKE '%Sousa%' OR name ILIKE '%Pereira%');

-- ============================================
-- PASSO 2: COMISSÃO TOTAL (substitua o código/telefone encontrado)
-- ============================================

-- Opção A: Se ele estiver na tabela affiliates, use o referrer_code:
WITH vendas_diretas AS (
    SELECT 
        COALESCE(SUM(amount) * 0.4901, 0) as comissao_direta
    FROM orders
    WHERE status = 'PAID'
      AND referrer_id = 'CODIGO_AQUI'  -- Substituir pelo código encontrado
),
vendas_sub_afiliados AS (
    SELECT 
        COALESCE(SUM(o.amount) * 0.25, 0) as comissao_subs
    FROM sub_affiliates sa
    JOIN orders o ON o.referrer_id = sa.sub_code AND o.status = 'PAID'
    WHERE sa.parent_phone = 'TELEFONE_AQUI'  -- Substituir pelo telefone encontrado
)
SELECT 
    vd.comissao_direta as comissao_vendas_diretas,
    vs.comissao_subs as comissao_sub_afiliados,
    (vd.comissao_direta + vs.comissao_subs) as TOTAL_COMISSAO
FROM vendas_diretas vd, vendas_sub_afiliados vs;

-- ============================================
-- OPÇÃO B: Se NÃO souber o código, buscar por nome em pedidos
-- ============================================

WITH telefone_marcos AS (
    -- Buscar telefone nos pedidos
    SELECT DISTINCT split_part(buyer_ref, '|', 2) as tel
    FROM orders
    WHERE buyer_ref ILIKE '%Marcos%'
      AND (buyer_ref ILIKE '%Luis%' OR buyer_ref ILIKE '%Luiz%')
      AND (buyer_ref ILIKE '%Sousa%' OR buyer_ref ILIKE '%Pereira%')
    LIMIT 1
),
codigo_afiliado AS (
    -- Buscar código de afiliado pelo telefone
    SELECT referrer_code as codigo
    FROM affiliates a, telefone_marcos t
    WHERE a.phone = t.tel
),
vendas_diretas AS (
    SELECT COALESCE(SUM(amount) * 0.4901, 0) as comissao
    FROM orders o, codigo_afiliado c
    WHERE o.status = 'PAID'
      AND o.referrer_id = c.codigo
),
vendas_sub AS (
    SELECT COALESCE(SUM(o.amount) * 0.25, 0) as comissao
    FROM sub_affiliates sa
    JOIN orders o ON o.referrer_id = sa.sub_code AND o.status = 'PAID'
    JOIN telefone_marcos t ON sa.parent_phone = t.tel
)
SELECT 
    t.tel as telefone_encontrado,
    c.codigo as codigo_afiliado,
    vd.comissao as comissao_vendas_diretas,
    vs.comissao as comissao_sub_afiliados,
    (vd.comissao + vs.comissao) as TOTAL_COMISSAO
FROM telefone_marcos t
CROSS JOIN codigo_afiliado c
CROSS JOIN vendas_diretas vd
CROSS JOIN vendas_sub vs;

-- ============================================
-- OPÇÃO C: SUPER SIMPLES - Buscar em TODAS as tabelas
-- ============================================

-- Se nada funcionar, use esta:
SELECT 
    'Marcos Luis de Sousa Pereira' as afiliado,
    COALESCE(SUM(
        CASE 
            WHEN o.referrer_id IN (SELECT referrer_code FROM affiliates WHERE name ILIKE '%Marcos%' AND name ILIKE '%Luis%')
            THEN o.amount * 0.4901
            ELSE 0
        END
    ), 0) as comissao_direta,
    COALESCE(SUM(
        CASE 
            WHEN o.referrer_id IN (SELECT sub_code FROM sub_affiliates WHERE parent_phone IN (SELECT phone FROM affiliates WHERE name ILIKE '%Marcos%' AND name ILIKE '%Luis%'))
            THEN o.amount * 0.25
            ELSE 0
        END
    ), 0) as comissao_subs,
    COALESCE(SUM(
        CASE 
            WHEN o.referrer_id IN (SELECT referrer_code FROM affiliates WHERE name ILIKE '%Marcos%' AND name ILIKE '%Luis%')
            THEN o.amount * 0.4901
            WHEN o.referrer_id IN (SELECT sub_code FROM sub_affiliates WHERE parent_phone IN (SELECT phone FROM affiliates WHERE name ILIKE '%Marcos%' AND name ILIKE '%Luis%'))
            THEN o.amount * 0.25
            ELSE 0
        END
    ), 0) as TOTAL_COMISSAO
FROM orders o
WHERE o.status = 'PAID';
