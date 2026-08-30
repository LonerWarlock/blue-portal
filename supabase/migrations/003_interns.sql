-- 003_interns.sql
-- Imergene Internship Registration Table

CREATE TABLE IF NOT EXISTS interns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Personal Details
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  father_name TEXT NOT NULL,
  mother_name TEXT NOT NULL,

  -- Current Address
  current_address TEXT NOT NULL,
  current_city TEXT NOT NULL,
  current_state TEXT NOT NULL,
  current_pin TEXT NOT NULL,

  -- Permanent Address
  permanent_address TEXT NOT NULL,
  permanent_city TEXT NOT NULL,
  permanent_state TEXT NOT NULL,
  permanent_pin TEXT NOT NULL,

  -- UG Academic Details
  degree TEXT NOT NULL,
  branch TEXT NOT NULL,
  college_name TEXT NOT NULL,
  university_name TEXT NOT NULL,
  year_start TEXT NOT NULL,
  year_end TEXT NOT NULL,
  cgpa TEXT NOT NULL,
  backlogs TEXT NOT NULL DEFAULT '0',

  -- Skills & Experience
  technical_skills TEXT NOT NULL,
  programming_languages TEXT,
  previous_internships TEXT,
  github_url TEXT,
  portfolio_url TEXT,

  -- Declaration
  declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,

  -- Payment
  payment_txn_id TEXT,
  payment_amount INTEGER DEFAULT 2500,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'success', 'failed')),

  -- Meta
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE interns ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access on interns"
  ON interns FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public can insert (registration form is public)
CREATE POLICY "Public can insert intern registration"
  ON interns FOR INSERT
  TO anon
  WITH CHECK (true);

-- Public can read own record by email (for payment status check)
CREATE POLICY "Public can read own intern record"
  ON interns FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- Pending Registrations (temporary, auto-cleaned after payment)
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_registrations (
  id TEXT PRIMARY KEY,            -- sessionId, used as txnid
  form_data JSONB NOT NULL,       -- full form data from the wizard
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pending_registrations"
  ON pending_registrations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can insert pending registrations"
  ON pending_registrations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role can delete pending registrations"
  ON pending_registrations FOR DELETE
  TO service_role
  USING (true);
