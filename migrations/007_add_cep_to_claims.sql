-- Add CEP column to az_claims
ALTER TABLE az_claims ADD COLUMN IF NOT EXISTS cep VARCHAR(20);
