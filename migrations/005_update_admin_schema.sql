-- Safe Migration to fix schema discrepancies and support Phone + Password auth

DO $$
BEGIN
    -- 1. Ensure 'name' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='name') THEN
        ALTER TABLE admin_users ADD COLUMN name VARCHAR(100);
    END IF;

    -- 2. Ensure 'phone' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='phone') THEN
        ALTER TABLE admin_users ADD COLUMN phone VARCHAR(20);
        ALTER TABLE admin_users ADD CONSTRAINT admin_users_phone_key UNIQUE (phone);
    END IF;

    -- 3. Ensure 'password_hash' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='password_hash') THEN
        ALTER TABLE admin_users ADD COLUMN password_hash TEXT;
    END IF;

    -- 4. Ensure 'is_active' column exists (default true)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='is_active') THEN
        ALTER TABLE admin_users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;

    -- 5. Handle 'email' column (make it nullable if exists, add it if not)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='email') THEN
        ALTER TABLE admin_users ALTER COLUMN email DROP NOT NULL;
    ELSE
        ALTER TABLE admin_users ADD COLUMN email VARCHAR(255);
    END IF;

END $$;
