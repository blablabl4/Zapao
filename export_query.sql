-- Execute this query to get your Participant List
-- You can export the result to CSV from your database client (DBeaver, PgAdmin, etc.)

SELECT 
    c.name as "Nome", 
    c.phone as "Telefone", 
    c.round_number as "Jogo", 
    count(t.id) as "Quantidade de Cotas"
FROM az_claims c
JOIN az_tickets t ON t.assigned_claim_id = c.id
WHERE c.campaign_id=21 AND c.status='PAID'
GROUP BY c.id, c.name, c.phone, c.round_number
ORDER BY c.round_number ASC, c.name ASC;
