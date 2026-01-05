-- Remove duplicates, keeping the latest one
DELETE FROM az_bolao_validations a USING (
    SELECT MIN(id) as id, phone 
    FROM az_bolao_validations 
    GROUP BY phone 
    HAVING COUNT(*) > 1
) b
WHERE a.phone = b.phone 
AND a.id <> b.id
AND a.id < (SELECT MAX(id) FROM az_bolao_validations WHERE phone = a.phone);

-- Ensure we really kept only one (the latest)
-- Actually the logic above might be complex. Simpler approach:
-- Delete all except the one with MAX id for each phone
DELETE FROM az_bolao_validations
WHERE id NOT IN (
    SELECT MAX(id)
    FROM az_bolao_validations
    GROUP BY phone
);

-- Now add unique constraint
ALTER TABLE az_bolao_validations ADD CONSTRAINT unique_phone_validation UNIQUE (phone);
