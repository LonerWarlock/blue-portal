-- Java Launchpad course registrations

CREATE TABLE IF NOT EXISTS java_course_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  current_status TEXT NOT NULL,
  java_experience TEXT NOT NULL,
  preferred_schedule TEXT NOT NULL,
  learning_goal TEXT,
  consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'java-course-landing-page',
  payment_txn_id TEXT,
  payu_payment_id TEXT,
  course_fee NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  gateway_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.02,
  payment_amount NUMERIC(10, 2) NOT NULL DEFAULT 1.02,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'success')),
  paid_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE java_course_registrations ENABLE ROW LEVEL SECURITY;

-- Registrations are written only by the server-side service-role client.
CREATE POLICY "Service role manages Java course registrations"
  ON java_course_registrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_java_course_registrations_email
  ON java_course_registrations (email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_java_course_registrations_payment_txn
  ON java_course_registrations (payment_txn_id)
  WHERE payment_txn_id IS NOT NULL;

ALTER TABLE java_course_registrations
  ADD CONSTRAINT java_course_success_requires_payment
  CHECK (
    payment_status <> 'success'
    OR (payment_txn_id IS NOT NULL AND paid_at IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_java_course_registrations_created_at
  ON java_course_registrations (created_at DESC);
