-- ============================================
-- RELATÓRIO COMPLETO DE AFILIADO
-- Afiliado: Marcos Luis de Sousa Pereira
-- ============================================

-- PASSO 1: Encontrar dados básicos do afiliado
SELECT 
    phone as telefone,
    name as nome,
    created_at as cadastrado_em,
    referrer_code as codigo_afiliado
FROM affiliates 
WHERE name ILIKE '%Marcos Luis%' 
   OR name ILIKE '%Marcos%Sousa%Pereira%';

-- Resultado esperado: telefone, código de afiliado
-- Usar o telefone abaixo para as próximas consultas

-- ============================================
-- PASSO 2: VENDAS DIRETAS (através do link principal)
-- ============================================

-- 2.1 Vendas por Rifa
SELECT 
    o.draw_id,
    d.draw_name,
    COUNT(*) as total_tickets,
    COUNT(DISTINCT o.buyer_ref) as clientes_unicos,
    SUM(o.amount) as receita_total,
    SUM(o.amount) * 0.5 as comissao_bruta_50pct,
    SUM(o.amount) * 0.4901 as comissao_liquida_49_01pct
FROM orders o
JOIN draws d ON o.draw_id = d.id
WHERE o.status = 'PAID'
  AND o.referrer_id IN (
      SELECT referrer_code 
      FROM affiliates 
      WHERE name ILIKE '%Marcos Luis%'
  )
GROUP BY o.draw_id, d.draw_name
ORDER BY o.draw_id DESC;

-- 2.2 Total Geral de Vendas Diretas
SELECT 
    COUNT(*) as total_tickets_geral,
    COUNT(DISTINCT buyer_ref) as total_clientes_unicos,
    SUM(amount) as receita_total_geral,
    SUM(amount) * 0.5 as comissao_bruta_50pct,
    SUM(amount) * 0.4901 as comissao_liquida_49_01pct
FROM orders
WHERE status = 'PAID'
  AND referrer_id IN (
      SELECT referrer_code 
      FROM affiliates 
      WHERE name ILIKE '%Marcos Luis%'
  );

-- ============================================
-- PASSO 3: SUB-AFILIADOS CRIADOS
-- ============================================

-- 3.1 Listar todos os sub-links criados
SELECT 
    sub_name as nome_sub_link,
    sub_code as codigo_sub_link,
    created_at as criado_em,
    'https://www.tvzapao.com.br/zapao-da-sorte?ref=' || sub_code as link_completo
FROM sub_affiliates
WHERE parent_phone IN (
    SELECT phone 
    FROM affiliates 
    WHERE name ILIKE '%Marcos Luis%'
)
ORDER BY created_at DESC;

-- 3.2 Performance dos Sub-Afiliados (vendas geradas)
SELECT 
    sa.sub_name,
    sa.sub_code,
    COUNT(o.order_id) as tickets_vendidos,
    COUNT(DISTINCT o.buyer_ref) as clientes_unicos,
    SUM(o.amount) as receita_gerada,
    SUM(o.amount) * 0.25 as comissao_sub_afiliado_25pct,
    SUM(o.amount) * 0.25 as comissao_marcos_25pct
FROM sub_affiliates sa
LEFT JOIN orders o ON o.referrer_id = sa.sub_code AND o.status = 'PAID'
WHERE sa.parent_phone IN (
    SELECT phone 
    FROM affiliates 
    WHERE name ILIKE '%Marcos Luis%'
)
GROUP BY sa.sub_name, sa.sub_code
ORDER BY receita_gerada DESC NULLS LAST;

-- 3.3 Total de Comissões de Sub-Afiliados
SELECT 
    COUNT(DISTINCT sa.sub_code) as total_sub_links_criados,
    COUNT(DISTINCT CASE WHEN o.order_id IS NOT NULL THEN sa.sub_code END) as sub_links_com_vendas,
    COALESCE(SUM(o.amount), 0) as receita_total_sub_afiliados,
    COALESCE(SUM(o.amount) * 0.25, 0) as comissao_total_marcos_25pct
FROM sub_affiliates sa
LEFT JOIN orders o ON o.referrer_id = sa.sub_code AND o.status = 'PAID'
WHERE sa.parent_phone IN (
    SELECT phone 
    FROM affiliates 
    WHERE name ILIKE '%Marcos Luis%'
);

-- ============================================
-- PASSO 4: RESUMO CONSOLIDADO
-- ============================================

WITH vendas_diretas AS (
    SELECT 
        COALESCE(SUM(amount), 0) as receita,
        COALESCE(SUM(amount) * 0.4901, 0) as comissao
    FROM orders
    WHERE status = 'PAID'
      AND referrer_id IN (
          SELECT referrer_code 
          FROM affiliates 
          WHERE name ILIKE '%Marcos Luis%'
      )
),
vendas_sub_afiliados AS (
    SELECT 
        COALESCE(SUM(o.amount), 0) as receita,
        COALESCE(SUM(o.amount) * 0.25, 0) as comissao
    FROM sub_affiliates sa
    LEFT JOIN orders o ON o.referrer_id = sa.sub_code AND o.status = 'PAID'
    WHERE sa.parent_phone IN (
        SELECT phone 
        FROM affiliates 
        WHERE name ILIKE '%Marcos Luis%'
    )
)
SELECT 
    'VENDAS DIRETAS' as tipo,
    vd.receita as receita_gerada,
    vd.comissao as comissao_marcos
FROM vendas_diretas vd
UNION ALL
SELECT 
    'VENDAS SUB-AFILIADOS' as tipo,
    vs.receita as receita_gerada,
    vs.comissao as comissao_marcos
FROM vendas_sub_afiliados vs
UNION ALL
SELECT 
    'TOTAL GERAL' as tipo,
    vd.receita + vs.receita as receita_gerada,
    vd.comissao + vs.comissao as comissao_total_marcos
FROM vendas_diretas vd, vendas_sub_afiliados vs;

-- ============================================
-- PASSO 5: HISTÓRICO DE ACESSOS (se disponível)
-- ============================================

SELECT 
    draw_id,
    COUNT(*) as total_acessos,
    COUNT(DISTINCT DATE(created_at)) as dias_com_acesso,
    MIN(created_at) as primeiro_acesso,
    MAX(created_at) as ultimo_acesso
FROM affiliate_clicks
WHERE referrer_id IN (
    SELECT referrer_code 
    FROM affiliates 
    WHERE name ILIKE '%Marcos Luis%'
)
GROUP BY draw_id
ORDER BY draw_id DESC;

-- ============================================
-- INSTRUÇÕES:
-- 1. Execute cada query separadamente no Railway PostgreSQL
-- 2. Copie os resultados para análise
-- 3. As queries estão ordenadas por importância
-- ============================================
