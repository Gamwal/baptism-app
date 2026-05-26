# Baptism Registry — Full Stack App

A church water baptism registration and interview management system.

---

## Stack

| Layer    | Technology                      |
|----------|---------------------------------|
| Frontend | React (Vite)                    |
| Backend  | Node.js · Express               |
| Database | SQLite via `better-sqlite3`     |
| Auth     | JWT (JSON Web Tokens) · bcryptjs|

---

## Folder Structure

```
baptism-registry/
├── backend/
│   ├── src/
│   │   ├── server.js               # Entry point
│   │   ├── db/
│   │   │   ├── index.js            # DB connection
│   │   │   └── seed.js             # Seed interviewers
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT middleware
│   │   └── routes/
│   │       ├── auth.js             # Login / profile
│   │       ├── registrations.js    # Public + protected CRUD
│   │       └── interviews.js       # Comments, certify, decline
│   ├── schema.sql                  # DB schema
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## Quick Start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env         # edit .env — especially JWT_SECRET
npm run seed                 # create default interviewer accounts
npm run dev                  # starts on http://localhost:4000
```

### 2. Frontend (React)

Create a Vite React project and point API calls to `http://localhost:4000/api`.

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install axios
npm run dev
```

---

## API Reference

### Public

| Method | Endpoint                  | Description              |
|--------|---------------------------|--------------------------|
| POST   | `/api/registrations`      | Submit baptism form      |

### Authenticated (interviewers)

| Method | Endpoint                                      | Description                    |
|--------|-----------------------------------------------|--------------------------------|
| POST   | `/api/auth/login`                             | Login, returns JWT             |
| GET    | `/api/auth/me`                                | Current user                   |
| GET    | `/api/registrations`                          | List all (filter by status)    |
| GET    | `/api/registrations/:id`                      | Single record + comments       |
| POST   | `/api/interviews/:id/comments`                | Add comment                    |
| PATCH  | `/api/interviews/:id/certify`                 | Certify candidate              |
| PATCH  | `/api/interviews/:id/decline`                 | Decline candidate              |
| GET    | `/api/interviews/stats`                       | Dashboard counts               |

### Authorization header

```
Authorization: Bearer <token>
```

---

## Default Accounts (after seed)

| Name                  | Email               | Password | Role        |
|-----------------------|---------------------|----------|-------------|
| Pastor James Okon     | james@church.org    | pass123  | admin       |
| Deaconess Ruth Bello  | ruth@church.org     | pass123  | interviewer |
| Elder Samuel Eze      | samuel@church.org   | pass123  | interviewer |

**Change all passwords before going live.**

---

## Registration Number Format

`BTZ-YYYY-NNN` — e.g. `BTZ-2024-001`

Generated automatically on each new submission.

---

## Candidate Status Flow

```
pending → scheduled → certified
                   ↘ declined
```

- `pending`   — just registered, no interviewer contact yet
- `scheduled` — interviewer has opened the record / added a comment
- `certified` — approved for water baptism
- `declined`  — not ready; needs further discipleship
