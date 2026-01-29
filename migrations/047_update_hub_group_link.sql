-- Atualiza o link do grupo no Hub para o novo link
UPDATE whatsapp_groups 
SET invite_link = 'https://chat.whatsapp.com/I1CWvd2A9jvAvgpCmz7tkU'
WHERE id = (SELECT MIN(id) FROM whatsapp_groups WHERE active = true);

-- Se não existir nenhum grupo ativo, insere um novo
INSERT INTO whatsapp_groups (name, invite_link, capacity, active, current_count)
SELECT 'Grupo VIP', 'https://chat.whatsapp.com/I1CWvd2A9jvAvgpCmz7tkU', 5000, true, 0
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_groups WHERE active = true);
