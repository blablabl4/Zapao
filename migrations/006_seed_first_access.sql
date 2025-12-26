-- Seed Initial Admins for First Access Flow
-- Inserts admins with NULL password_hash if they don't exist

DO $$
BEGIN
    -- 0. Fix Legacy Constraint: Remove single admin limit
    DROP INDEX IF EXISTS idx_single_admin;

    -- 1. Fix Legacy Schema: Make 'username' nullable if it exists (since we switched to phone)
    -- Or we can drop the constraint.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='username') THEN
        ALTER TABLE admin_users ALTER COLUMN username DROP NOT NULL;
        ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_username_key; -- Drop unique constraint if needed
    END IF;

    -- 2. Fix Legacy Schema: Make 'password_hash' nullable to support First Access flow
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='password_hash') THEN
        ALTER TABLE admin_users ALTER COLUMN password_hash DROP NOT NULL;
    END IF;

    -- 3. Seed Users
    -- Fabio
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE phone = '11981771974') THEN
        INSERT INTO admin_users (name, phone, password_hash, is_active)
        VALUES ('Fabio', '11981771974', NULL, TRUE);
    END IF;

    -- Isaque
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE phone = '11983426767') THEN
        INSERT INTO admin_users (name, phone, password_hash, is_active)
        VALUES ('Isaque', '11983426767', NULL, TRUE);
    END IF;
END $$;
