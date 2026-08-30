-- Upgrade an existing pre-payment Java course registration table.
-- Existing rows remain preserved with payment_status = 'pending'.

ALTER TABLE java_course_registrations
  ADD COLUMN IF NOT EXISTS payment_txn_id TEXT,
  ADD COLUMN IF NOT EXISTS payu_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS course_fee NUMERIC(10, 2) NOT NULL DEFAULT 2500.00,
  ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(10, 2) NOT NULL DEFAULT 59.00,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2) NOT NULL DEFAULT 2559.00,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE java_course_registrations
  ALTER COLUMN course_fee SET DEFAULT 2500.00,
  ALTER COLUMN gateway_fee SET DEFAULT 59.00,
  ALTER COLUMN payment_amount SET DEFAULT 2559.00;

UPDATE java_course_registrations
SET payment_status = 'pending'
WHERE payment_status IS NULL
   OR payment_status NOT IN ('pending', 'success');

UPDATE java_course_registrations
SET course_fee = 2500.00,
    gateway_fee = 59.00,
    payment_amount = 2559.00
WHERE payment_status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_java_course_registrations_payment_txn
  ON java_course_registrations (payment_txn_id)
  WHERE payment_txn_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'java_course_payment_status_valid'
      AND conrelid = 'java_course_registrations'::regclass
  ) THEN
    ALTER TABLE java_course_registrations
      ADD CONSTRAINT java_course_payment_status_valid
      CHECK (payment_status IN ('pending', 'success'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'java_course_success_requires_payment'
      AND conrelid = 'java_course_registrations'::regclass
  ) THEN
    ALTER TABLE java_course_registrations
      ADD CONSTRAINT java_course_success_requires_payment
      CHECK (
        payment_status <> 'success'
        OR (payment_txn_id IS NOT NULL AND paid_at IS NOT NULL)
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
