-- Fix missing last_login column in admin_users

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='last_login') THEN
        ALTER TABLE admin_users ADD COLUMN last_login TIMESTAMP;
    END IF;
END $$;
