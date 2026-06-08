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

-- Migrations for existing databases (safe to re-run)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS salvation_date      TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS sanctification_date TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS holy_ghost_date     TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS area_id             TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS zone_id             TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS branch_id           TEXT;
