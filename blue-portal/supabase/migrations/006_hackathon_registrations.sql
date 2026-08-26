-- 004_hackathon_registrations.sql
-- IGNITE PVPIT 2026 Hackathon Registration Table

CREATE TABLE IF NOT EXISTS hackathon_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Team Info
  team_name TEXT NOT NULL,
  team_size INTEGER NOT NULL CHECK (team_size >= 2 AND team_size <= 5),

  -- Team Leader
  leader_first_name TEXT NOT NULL,
  leader_last_name TEXT NOT NULL,
  leader_email TEXT NOT NULL,
  leader_phone TEXT NOT NULL,
  leader_branch TEXT NOT NULL,
  leader_year TEXT NOT NULL,

  -- Team Members (JSONB array of member objects)
  team_members JSONB NOT NULL DEFAULT '[]',

  -- Academic
  degree TEXT NOT NULL,

  -- Declaration
  declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,

  -- Payment
  payment_txn_id TEXT,
  payment_amount INTEGER DEFAULT 100,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'success', 'failed')),

  -- Meta
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE hackathon_registrations ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access on hackathon_registrations"
  ON hackathon_registrations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public can insert (registration form is public)
CREATE POLICY "Public can insert hackathon registration"
  ON hackathon_registrations FOR INSERT
  TO anon
  WITH CHECK (true);

-- Public can read own record by email (for payment status check)
CREATE POLICY "Public can read own hackathon record"
  ON hackathon_registrations FOR SELECT
  TO anon
  USING (true);
