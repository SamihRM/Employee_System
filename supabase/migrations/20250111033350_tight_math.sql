-- ========================
-- 1. Drop Existing Tables
-- ========================
DROP TABLE IF EXISTS attendance_records;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS profiles;

-- ========================
-- 2. Re-Create Tables
-- ========================

-- profiles table
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'employee',
  hourly_wage numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- locations table
CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  link text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- attendance_records table
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  check_in timestamptz NOT NULL,
  check_out timestamptz,
  task text,
  comments text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- ==============================
-- 3. Create "is_admin" Function
-- ==============================
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role = 'admin'
  FROM profiles
  WHERE id = uid;
$$;

-- ======================================
-- 4. Row-Level Security (RLS) Policies
-- ======================================

-- Profiles policies
CREATE POLICY "user_can_view_own_profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "only_admin_can_insert_profiles"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "only_admin_can_update_profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "only_admin_can_delete_profiles"
ON profiles
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Locations policies
CREATE POLICY "anyone_can_view_locations"
ON locations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "only_admin_can_insert_locations"
ON locations
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "only_admin_can_update_locations"
ON locations
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "only_admin_can_delete_locations"
ON locations
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Allow employees to access their own attendance records
CREATE POLICY "user_can_access_own_attendance"
ON attendance_records
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Allow admins to access all attendance records
CREATE POLICY "admin_can_access_all_attendance"
ON attendance_records
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "user_or_admin_can_update_attendance"
ON attendance_records
FOR UPDATE
TO authenticated
USING ((profile_id = auth.uid()) OR is_admin(auth.uid()))
WITH CHECK ((profile_id = auth.uid()) OR is_admin(auth.uid()));

-- ============================
-- 5. Add Unique Constraint
-- ============================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE auth.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- =============================
-- 6. Create Initial Admin User
-- =============================
CREATE OR REPLACE FUNCTION create_initial_admin()
RETURNS void AS $$
DECLARE
  admin_id uuid;
BEGIN
  -- Insert admin user if it doesn't exist
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role)
  VALUES (
    gen_random_uuid(),
    'admin@example.de',
    crypt('Admin123', gen_salt('bf')),
    now(),
    'authenticated'
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO admin_id;

  -- Create admin profile if the admin user was inserted
  IF admin_id IS NOT NULL THEN
    INSERT INTO profiles (id, first_name, last_name, role)
    VALUES (admin_id, 'Admin', 'User', 'admin')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================
-- 7. Ensure Profiles for All Users
-- =============================

-- Automatically create profiles for users without corresponding profiles
DO $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, role)
  SELECT id, 'DefaultFirstName', 'DefaultLastName', 'employee'
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM profiles);
END $$;

-- =============================
-- 8. Call Initial Admin Function
-- =============================
--SELECT create_initial_admin();
UPDATE profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.de');
SELECT * FROM profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.de');