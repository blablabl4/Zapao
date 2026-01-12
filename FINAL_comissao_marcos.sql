-- ============================================
-- COMISSÃO TOTAL - Marcos Luis - TODAS AS RIFAS
-- RESULTADO FINAL E CONSOLIDADO
-- ============================================

-- QUERY ÚNICA - COPIE E COLE NO RAILWAY
-- Retorna: Total de comissão de TODAS as rifas

SELECT 
    'MARCOS LUIS DE SOUSA PEREIRA' as afiliado,
    
    -- Vendas diretas (49.01% de comissão)
    COUNT(DISTINCT CASE 
        WHEN o.referrer_id IN (
            SELECT referrer_code FROM affiliates 
            WHERE name ILIKE '%Marcos%' 
              AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
        ) THEN o.order_id 
    END) as tickets_vendidos_direto,
    
    COALESCE(SUM(CASE 
        WHEN o.referrer_id IN (
            SELECT referrer_code FROM affiliates 
            WHERE name ILIKE '%Marcos%' 
              AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
        ) THEN o.amount * 0.4901
        ELSE 0 
    END), 0) as comissao_vendas_diretas,
    
    -- Sub-afiliados (25% de comissão para ele)
    COUNT(DISTINCT CASE 
        WHEN o.referrer_id IN (
            SELECT sub_code FROM sub_affiliates 
            WHERE parent_phone IN (
                SELECT phone FROM affiliates 
                WHERE name ILIKE '%Marcos%' 
                  AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
            )
        ) THEN o.order_id 
    END) as tickets_vendidos_subs,
    
    COALESCE(SUM(CASE 
        WHEN o.referrer_id IN (
            SELECT sub_code FROM sub_affiliates 
            WHERE parent_phone IN (
                SELECT phone FROM affiliates 
                WHERE name ILIKE '%Marcos%' 
                  AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
            )
        ) THEN o.amount * 0.25
        ELSE 0 
    END), 0) as comissao_sub_afiliados,
    
    -- TOTAL GERAL
    COALESCE(SUM(CASE 
        WHEN o.referrer_id IN (
            SELECT referrer_code FROM affiliates 
            WHERE name ILIKE '%Marcos%' 
              AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
        ) THEN o.amount * 0.4901
        WHEN o.referrer_id IN (
            SELECT sub_code FROM sub_affiliates 
            WHERE parent_phone IN (
                SELECT phone FROM affiliates 
                WHERE name ILIKE '%Marcos%' 
                  AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
            )
        ) THEN o.amount * 0.25
        ELSE 0 
    END), 0) as COMISSAO_TOTAL_GERAL,
    
    -- Quantidade de rifas com vendas
    COUNT(DISTINCT o.draw_id) as rifas_com_vendas
    
FROM orders o
WHERE o.status = 'PAID';


-- ============================================
-- DETALHAMENTO POR RIFA (OPCIONAL)
-- ============================================

SELECT 
    d.id as rifa_id,
    d.draw_name as nome_rifa,
    d.status as status_rifa,
    
    COUNT(CASE 
        WHEN o.referrer_id IN (
            SELECT referrer_code FROM affiliates 
            WHERE name ILIKE '%Marcos%' 
              AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
        ) THEN 1 
    END) as tickets_diretos,
    
    COUNT(CASE 
        WHEN o.referrer_id IN (
            SELECT sub_code FROM sub_affiliates 
            WHERE parent_phone IN (
                SELECT phone FROM affiliates 
                WHERE name ILIKE '%Marcos%' 
                  AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
            )
        ) THEN 1 
    END) as tickets_subs,
    
    COALESCE(SUM(CASE 
        WHEN o.referrer_id IN (
            SELECT referrer_code FROM affiliates 
            WHERE name ILIKE '%Marcos%' 
              AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
        ) THEN o.amount * 0.4901
        WHEN o.referrer_id IN (
            SELECT sub_code FROM sub_affiliates 
            WHERE parent_phone IN (
                SELECT phone FROM affiliates 
                WHERE name ILIKE '%Marcos%' 
                  AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
            )
        ) THEN o.amount * 0.25
        ELSE 0 
    END), 0) as comissao_total_rifa
    
FROM draws d
LEFT JOIN orders o ON o.draw_id = d.id AND o.status = 'PAID'
GROUP BY d.id, d.draw_name, d.status
HAVING COUNT(CASE 
    WHEN o.referrer_id IN (
        SELECT referrer_code FROM affiliates 
        WHERE name ILIKE '%Marcos%' 
          AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
    ) THEN 1 
    WHEN o.referrer_id IN (
        SELECT sub_code FROM sub_affiliates 
        WHERE parent_phone IN (
            SELECT phone FROM affiliates 
            WHERE name ILIKE '%Marcos%' 
              AND (name ILIKE '%Luis%' OR name ILIKE '%Luiz%')
        )
    ) THEN 1 
END) > 0
ORDER BY d.id DESC;
