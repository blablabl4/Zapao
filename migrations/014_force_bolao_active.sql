-- Ensure Bolão Campaign exists and is active
INSERT INTO az_campaigns (name, start_number, end_number, base_qty_config, is_active, type, current_round, price)
SELECT 'Bolão do Zapão - Mega da Virada', 1, 100, '{}', true, 'BOLAO', 1, 20.00
WHERE NOT EXISTS (SELECT 1 FROM az_campaigns WHERE type = 'BOLAO');

UPDATE az_campaigns 
SET is_active = true 
WHERE type = 'BOLAO' AND is_active = false;
