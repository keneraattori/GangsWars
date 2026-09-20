# Local Development

> This file will be filled in with exact commands as M0 (repo scaffold) is implemented. Placeholder plan below.

## Prerequisites

- Node.js LTS
- Docker Desktop (for local PostgreSQL)
- Azure Static Web Apps CLI (`swa-cli`) — only needed once we start emulating the Azure Functions API locally, around M9

## Local Postgres

```powershell
docker compose up -d
```

Spins up a `postgres` container using `docker-compose.yml` at the repo root. Connection string goes in `backend/.env` (never committed — see `.env.example`).

## Backend

```powershell
cd backend
npm install
npm run dev   # starts Express server with hot reload, e.g. via nodemon/tsx
```

Runs the API at `http://localhost:3000` (or configured port).

## Frontend

```powershell
cd frontend
npm install
npm run dev   # Vite dev server
```

Runs the React app at `http://localhost:5173`, proxying `/api` calls to the backend dev server (configure in `vite.config.*`).

## Running both together

Until we add a root-level dev script (`concurrently` or npm workspaces), run backend and frontend in two terminals.

## Environment variables

`backend/.env` (see `backend/.env.example` once created):
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gangwars
JWT_SECRET=dev-only-secret-change-me
PORT=3000
```

Never commit real secrets. `.env` is git-ignored.

## Tests

```powershell
cd backend
npm test
```

Unit tests for `services/` (game rules, phase resolution) should not require Docker/DB — they operate on plain in-memory game state.
