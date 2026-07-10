-- PostgreSQL schema (Neon / Vercel Postgres)
-- Run once via: npm run db:setup

CREATE TABLE IF NOT EXISTS interviewers (
  id            SERIAL       PRIMARY KEY,
  name          TEXT         NOT NULL,
  email         TEXT         NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          TEXT         NOT NULL DEFAULT 'interviewer',
  created_at    TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- Atomic registration-number generator — avoids the COUNT(*)+1 race where
-- two concurrent submissions could compute the same next number.
CREATE SEQUENCE IF NOT EXISTS reg_number_seq;

CREATE TABLE IF NOT EXISTS registrations (
  id                      SERIAL       PRIMARY KEY,
  reg_number              TEXT         NOT NULL UNIQUE,

  -- Personal Information
  full_name               TEXT         NOT NULL,
  gender                  TEXT         NOT NULL,
  date_of_birth           TEXT,
  age                     TEXT,
  marital_status          TEXT         NOT NULL,
  residential_address     TEXT         NOT NULL,
  phone_number            TEXT         NOT NULL,
  email                   TEXT,
  occupation              TEXT,
  nationality             TEXT,
  state_of_origin         TEXT,

  -- Church Information (names selected from AFM directory; ids kept for traceability)
  branch_church           TEXT         NOT NULL,
  branch_id               TEXT,
  zone                    TEXT,
  zone_id                 TEXT,
  area                    TEXT,
  area_id                 TEXT,
  group_pastor_name       TEXT,

  -- Spiritual Experiences (each optional, date recorded when present)
  salvation_experience        TEXT,
  salvation_date              TEXT,
  sanctification_experience   TEXT,
  sanctification_date         TEXT,
  holy_ghost_baptism          TEXT,
  holy_ghost_date             TEXT,

  -- Previous Baptism
  previously_baptized     INTEGER      DEFAULT 0,
  prev_church_name        TEXT,
  prev_mode_of_baptism    TEXT,
  prev_baptism_date       TEXT,

  -- Parent / Guardian
  is_minor                INTEGER      DEFAULT 0,
  guardian_name           TEXT,
  guardian_phone          TEXT,
  guardian_consent        INTEGER      DEFAULT 0,
  guardian_signature      TEXT,

  -- Interview slot
  interview_date          TEXT         NOT NULL,
  interview_time          TEXT         NOT NULL,

  -- Status
  status                  TEXT         NOT NULL DEFAULT 'pending',
  interviewer_id          INTEGER      REFERENCES interviewers(id),
  created_at              TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_comments (
  id              SERIAL       PRIMARY KEY,
  registration_id INTEGER      NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  interviewer_id  INTEGER      NOT NULL REFERENCES interviewers(id),
  comment         TEXT         NOT NULL,
  created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- Single-row settings table that the slot scheduler consults
CREATE TABLE IF NOT EXISTS interview_settings (
  id            INTEGER     PRIMARY KEY,
  slot_minutes  INTEGER     NOT NULL DEFAULT 15,
  start_hour    INTEGER     NOT NULL DEFAULT 9,
  end_hour      INTEGER     NOT NULL DEFAULT 17,
  lead_days     INTEGER     NOT NULL DEFAULT 3,
  days_of_week  TEXT        NOT NULL DEFAULT '1,2,3,4,5,6',  -- 0=Sun..6=Sat
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (id = 1)
);
INSERT INTO interview_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_reg_number     ON registrations(reg_number);
CREATE INDEX IF NOT EXISTS idx_reg_status     ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_reg_interview  ON registrations(interview_date, interview_time);
CREATE INDEX IF NOT EXISTS idx_comment_reg    ON interview_comments(registration_id);
CREATE INDEX IF NOT EXISTS idx_reg_phone      ON registrations(phone_number);

-- Prevents two candidates from ever holding the same interview slot,
-- even under concurrent registration requests. Wrapped in a DO block so that
-- if an existing database already has duplicate slots (from before this fix),
-- the rest of this migration still applies instead of rolling back entirely —
-- run `SELECT interview_date, interview_time, COUNT(*) FROM registrations
-- GROUP BY 1,2 HAVING COUNT(*) > 1;` to find and manually resolve them, then
-- re-run db:setup to add the index.
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_slot ON registrations(interview_date, interview_time);
EXCEPTION WHEN unique_violation OR others THEN
  RAISE WARNING 'Could not create uq_reg_slot — duplicate (interview_date, interview_time) rows exist. Resolve them and re-run db:setup.';
END $$;

-- reg_number_seq starts at 1, but a database that already has rows from the
-- old COUNT(*)+1 numbering scheme needs the sequence advanced past every
-- number already issued, or the very next registration will collide with an
-- existing reg_number. Only ever moves the sequence forward — safe to re-run.
DO $$
DECLARE
  max_existing   INTEGER;
  current_seq_val BIGINT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(reg_number, '^WB-\d{4}-', ''), '')::int), 0)
    INTO max_existing
    FROM registrations
    WHERE reg_number ~ '^WB-\d{4}-\d+$';

  SELECT last_value INTO current_seq_val FROM reg_number_seq;

  IF max_existing > current_seq_val THEN
    PERFORM setval('reg_number_seq', max_existing, true);
  END IF;
END $$;

-- Audit trail / outbox for notifications (Phase 3). Log-only today; a real
-- email/SMS driver can later read unsent rows from this table.
CREATE TABLE IF NOT EXISTS notifications_log (
  id              SERIAL       PRIMARY KEY,
  event           TEXT         NOT NULL,
  registration_id INTEGER      REFERENCES registrations(id) ON DELETE CASCADE,
  payload         JSONB,
  created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notif_reg ON notifications_log(registration_id);

-- Migrations for existing databases (safe to re-run)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS salvation_date      TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS sanctification_date TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS holy_ghost_date     TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS area_id             TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS zone_id             TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS branch_id           TEXT;
