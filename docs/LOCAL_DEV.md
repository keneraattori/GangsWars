# Local Development

# Local Development

## Prerequisites

- Node.js 20+ (developed against v24)
- Docker Desktop (for local PostgreSQL) — install separately if not already present
- Azure Static Web Apps CLI (`swa-cli`) — only needed once we start emulating the Azure Functions API locally, around M9

## Install

From the repo root (npm workspaces manage `frontend/`, `backend/`, `shared/` together):

```powershell
npm install
```

## Local Postgres

```powershell
docker compose up -d
```

Spins up a `postgres` container using `docker-compose.yml` at the repo root (db `gangwars`, user/password `postgres`/`postgres`, port 5432). Not yet wired into the backend — added when M1 (auth) needs a real database connection.

## Backend

```powershell
npm run dev:backend
```

Starts the Express server (via `tsx watch`) at `http://localhost:3000`. Health check: `GET http://localhost:3000/api/health` → `{ "status": "ok" }`.

## Frontend

```powershell
npm run dev:frontend
```

Starts the Vite dev server at `http://localhost:5173`. Requests to `/api/*` are proxied to `http://localhost:3000` (see `frontend/vite.config.ts`), so run the backend alongside it.

## Running both together

Two terminals for now: `npm run dev:backend` and `npm run dev:frontend`. A combined script (`concurrently`) can be added later if it becomes annoying.

## Environment variables

`backend/.env` (copy from `backend/.env.example`, never commit the real file — it's git-ignored):
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gangwars
JWT_SECRET=dev-only-secret-change-me
PORT=3000
```

## Lint & test

```powershell
npm run lint          # lints backend + frontend
npm run test:backend  # runs backend vitest suite
```

Backend unit tests (`backend/test/`) don't require Docker/Postgres to be running — they operate on the Express app in-process (see `backend/test/health.test.ts`).
