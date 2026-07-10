# Apostolic Faith Church — Water Baptism Registry

A full-stack app for registering water baptism candidates, auto-assigning
them an interview slot, and letting interviewers review, comment on, and
certify or decline each candidate. Candidates can track their status and
download a printable PDF slip; admins can manage interviewer accounts,
configure interview slot rules, and export the full candidate list to Excel.

---

## Stack

| Layer      | Technology                                    |
|------------|------------------------------------------------|
| Frontend   | React 18 (Vite)                                 |
| Backend    | Node.js · Express 4                             |
| Database   | PostgreSQL (built for [Neon](https://neon.tech), free tier) |
| Auth       | JWT (JSON Web Tokens) · bcryptjs                |
| Logging    | pino (structured logs, pretty-printed in dev)   |
| Testing    | Vitest + Supertest                              |
| Deployment | Single Express server locally, or Vercel (static frontend + serverless API) |

External integration: the church-directory dropdowns (Area / Zone / Branch)
are proxied from the [AFM Weca church API](https://api.afmweca.org), with an
in-memory cache and stale-on-error fallback.

---

## Folder Structure

```
baptism-app/
├── backend/
│   ├── src/
│   │   ├── server.js               # Express app (entry point)
│   │   ├── config.js               # Env var loading; fails fast in prod if JWT_SECRET is missing
│   │   ├── logger.js               # pino logger (pretty in dev, JSON in prod)
│   │   ├── db/
│   │   │   ├── index.js            # pg Pool connection
│   │   │   ├── setup.js            # Applies schema.pg.sql (idempotent)
│   │   │   └── seed.js             # Creates 3 default interviewer accounts
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT auth + requireAdmin middleware
│   │   ├── routes/
│   │   │   ├── auth.js             # Login, profile, change password
│   │   │   ├── registrations.js    # Public registration + interviewer list/detail/export/track
│   │   │   ├── interviews.js       # Comments, certify, decline, reschedule, free-slots
│   │   │   ├── interviewers.js     # Admin: list/add/remove interviewers, reset password
│   │   │   ├── settings.js         # Admin: interview slot configuration
│   │   │   └── church.js           # Proxy + cache for the AFM area/zone/branch directory
│   │   └── utils/
│   │       ├── scheduler.js        # Interview slot search (pure functions + DB wrappers)
│   │       ├── validation.js       # Pure registration validation helpers
│   │       ├── notifier.js         # Event log hook (registration/reschedule/certify/decline)
│   │       └── add-interviewer.js  # CLI: create an interviewer account
│   ├── test/                       # Vitest unit + API tests
│   ├── schema.pg.sql                # PostgreSQL schema (idempotent — safe to re-run)
│   └── package.json
├── client/
│   ├── src/
│   │   ├── pages/                  # RegistrationForm, InterviewerDashboard, CandidateDetail, …
│   │   ├── components/             # Navbar, Logo, ProtectedRoute
│   │   ├── contexts/AuthContext.jsx
│   │   ├── services/api.js         # All backend calls
│   │   └── utils/format.js         # Shared date/time formatters (timezone-safe)
│   └── public/                     # africa-for-christ.png, jesus-light-world.png
├── api/index.js                    # Vercel serverless entry point (re-exports the Express app)
├── vercel.json                     # Vercel build/rewrite config
└── .github/workflows/ci.yml        # Syntax check + tests (backend), build (frontend)
```

---

## Local Setup

### 1. Get a database
Create a free Postgres database at [neon.tech](https://neon.tech) and copy its connection string.

### 2. Configure environment
```bash
cp backend/.env.example backend/.env
# edit backend/.env:
#   DATABASE_URL=<your Neon connection string>
#   JWT_SECRET=<any long random string>
```

### 3. Install, set up the database, seed accounts
```bash
npm run install:all   # installs both backend/ and client/ dependencies
npm run db:setup       # applies schema.pg.sql (safe to re-run any time)
npm run seed            # creates 3 default interviewer accounts (see below)
```

### 4. Run
```bash
npm run dev   # backend on :4000 (hot-reload) + frontend on :5173 (Vite, hot-reload)
```
Open **http://localhost:5173**.

### Production-style single-port run
```bash
npm run build   # builds the React app into client/dist
npm start        # Express serves both the API and the built frontend on :4000
```
Open **http://localhost:4000**.

---

## Available Scripts

| Location | Script | What it does |
|----------|--------|---------------|
| root | `npm run install:all` | Installs backend + client dependencies |
| root | `npm run dev` | Runs backend (nodemon) and client (Vite) concurrently |
| root | `npm run db:setup` | Applies/updates the Postgres schema |
| root | `npm run seed` | Creates the 3 default interviewer accounts |
| root | `npm run build` | Builds the React frontend |
| root | `npm start` | Starts Express serving API + built frontend on one port |
| backend | `npm run add-interviewer -- "Name" email@x.com password [admin]` | CLI to create one interviewer account |
| backend | `npm test` | Runs the Vitest suite (unit + API tests, no real DB needed) |

---

## Environment Variables

Set in `backend/.env` (see `backend/.env.example`):

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Postgres connection string (Neon or any Postgres) |
| `JWT_SECRET` | Yes in production | Server refuses to start in production without it. Falls back to an insecure dev-only default locally, with a warning. |
| `PORT` | No | Defaults to 4000. Ignored on Vercel. |
| `FRONTEND_URL` | No | CORS origin allow-list for local dev. Defaults to `*`. |
| `LOG_LEVEL` | No | pino log level. Defaults to `debug` locally, `info` in production. |

---

## API Reference

### Public (no auth)

| Method | Endpoint | Description |
|--------|----------|--------------|
| POST | `/api/registrations` | Submit the baptism registration form. Auto-assigns the next free interview slot, generates a `WB-YYYY-NNNNN` tracking number, and rejects duplicate phone numbers with a 409. |
| GET | `/api/registrations/track/:regNumber` | Look up a registration's status by tracking number. Returns only name/status/interview slot — no contact or spiritual-answer data. |
| GET | `/api/church/areas` | List AFM areas (cached, stale-on-error). |
| GET | `/api/church/zones?areaId=` | List zones within an area. |
| GET | `/api/church/branches?areaId=&zoneId=` | List branches within a zone. |
| POST | `/api/auth/login` | Interviewer login → `{ token, interviewer }`. |
| GET | `/api/health` | Health check. |

### Authenticated (any interviewer)

Send `Authorization: Bearer <token>` on all of these.

| Method | Endpoint | Description |
|--------|----------|--------------|
| GET | `/api/auth/me` | Current interviewer's profile. |
| PATCH | `/api/auth/password` | Change your own password (requires current password). |
| GET | `/api/registrations` | List/search candidates. Supports `status`, `search`, `page`, `limit`, and `dateFrom`/`dateTo` (switches sort to interview-date order for the Schedule view). |
| GET | `/api/registrations/:id` | Full candidate record + comment history. |
| GET | `/api/interviews/stats` | Dashboard counts by status. |
| GET | `/api/interviews/free-slots?date=YYYY-MM-DD` | Free interview times on a given date (for rescheduling). |
| POST | `/api/interviews/:id/comments` | Add a comment; moves `pending` → `scheduled` on first contact. |
| PATCH | `/api/interviews/:id/certify` | Certify the candidate for baptism. |
| PATCH | `/api/interviews/:id/decline` | Decline the candidate. |
| PATCH | `/api/interviews/:id/reschedule` | Move a candidate to a different free slot; logs an automatic comment. |
| GET | `/api/settings` | Read the current interview slot configuration. |

### Admin only

| Method | Endpoint | Description |
|--------|----------|--------------|
| GET | `/api/interviewers` | List all interviewer accounts. |
| POST | `/api/interviewers` | Create a new interviewer/admin account. |
| PATCH | `/api/interviewers/:id/reset-password` | Reset an interviewer's password to a new random temporary one (shown once). |
| DELETE | `/api/interviewers/:id` | Remove an interviewer (can't delete your own account). |
| PATCH | `/api/settings` | Update interview slot length, hours, lead time, and days of week. |
| GET | `/api/registrations/export` | Download every registration as an `.xlsx` workbook. |

---

## Default Accounts (after `npm run seed`)

| Name | Email | Password | Role |
|------|-------|----------|------|
| Pastor James Okon | james@church.org | pass123 | admin |
| Deaconess Ruth Bello | ruth@church.org | pass123 | interviewer |
| Elder Samuel Eze | samuel@church.org | pass123 | interviewer |

**Change these passwords (or delete the accounts) before going live.** Admins
can add real accounts from the "Interviewers" page in the app, or via:
```bash
cd backend && npm run add-interviewer -- "Full Name" email@church.org apassword [admin]
```

---

## Registration Number Format

`WB-YYYY-NNNNN` — e.g. `WB-2026-00042`, generated atomically from a database
sequence (never repeats or collides, even under concurrent submissions).

## Candidate Status Flow

```
pending → scheduled → certified
                   ↘ declined
```

- `pending` — just registered, no interviewer contact yet
- `scheduled` — an interviewer has opened the record or added a comment
- `certified` — approved for water baptism
- `declined` — not ready; needs further discipleship

## Interview Slot Scheduling

New registrations are auto-assigned the next free slot according to the
admin-configurable rules on the **Settings** page (default: 15-minute slots,
09:00–17:00, Monday–Saturday, 3-day minimum lead time). Interviewers can move
an already-booked candidate to a different free slot from the candidate
detail page; a `UNIQUE` constraint on `(interview_date, interview_time)`
makes double-booking impossible even under concurrent requests.

---

## Testing

```bash
cd backend && npm test
```

Runs entirely offline — no real database or secrets required (the suite sets
safe fallback env vars itself). Covers:
- **Unit tests** — slot-finding logic (day-of-week filtering, lead time,
  booked-slot skipping), and registration validation (age/minor calculation,
  phone/email format, spiritual-experience date ordering).
- **API tests** — login (success/failure paths, no password-hash leakage),
  the public tracking endpoint (field allow-listing), registration
  validation wired end-to-end through Express, and the JSON 404 handler.

## CI

`.github/workflows/ci.yml` runs on every push/PR: backend syntax check +
`npm test`, and a frontend production build — both from a clean `npm install`
with no committed lockfiles, so platform-specific dependency issues (e.g. a
native binary resolved for the wrong OS/architecture) surface immediately
instead of only showing up on a teammate's machine.

---

## Deploying to Vercel

```bash
npm i -g vercel
vercel
```

Add these two environment variables when prompted (or in the Vercel
dashboard under Project → Settings → Environment Variables):

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | A long random string |

`vercel.json` builds the React app (`vercel:build`) and serves it as static
files, while `api/index.js` re-exports the same Express app as a serverless
function handling everything under `/api/*`. No code changes are needed
between local and Vercel — the same Express app runs in both places.
