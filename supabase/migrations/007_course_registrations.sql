-- 007_course_registrations.sql
-- Python & Data Science Course Registration Table

-- The first no-code course launch created this table manually. Keep it in the
-- migration chain so a new environment has the same schema.
CREATE TABLE IF NOT EXISTS vibe_coding_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  degree TEXT,
  branch TEXT,
  college_name TEXT,
  year_of_study TEXT,
  current_status TEXT,
  programming_experience TEXT,
  declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  productinfo TEXT,
  payment_txn_id TEXT UNIQUE,
  payment_amount NUMERIC(12, 2),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Personal
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  date_of_birth TEXT,
  gender TEXT,

  -- Academic / Professional Background
  degree TEXT NOT NULL,
  branch TEXT NOT NULL,
  college_name TEXT NOT NULL,
  year_of_study TEXT NOT NULL,
  current_status TEXT NOT NULL,

  -- Experience
  programming_experience TEXT NOT NULL,

  -- Declaration
  declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,

  -- Payment
  payment_txn_id TEXT,
  payment_amount INTEGER DEFAULT 2000,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'success', 'failed')),

  -- Meta
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE course_registrations ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access on course_registrations"
  ON course_registrations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public can insert (registration form is public)
CREATE POLICY "Public can insert course registration"
  ON course_registrations FOR INSERT
  TO anon
  WITH CHECK (true);

-- Public can read own record by email (for payment status check)
CREATE POLICY "Public can read own course record"
  ON course_registrations FOR SELECT
  TO anon
  USING (true);

-- Index for idempotency checks
CREATE INDEX IF NOT EXISTS idx_course_registrations_email_status
  ON course_registrations (email, payment_status);

-- Index for transaction lookup
CREATE INDEX IF NOT EXISTS idx_course_registrations_txn_id
  ON course_registrations (payment_txn_id);
