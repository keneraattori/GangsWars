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

Start Docker Desktop first, then run these commands from the repository root:

```powershell
docker compose up -d
npm run migrate:up --workspace backend
```

Spins up a `postgres` container using `docker-compose.yml` at the repo root (db `gangwars`, user/password `postgres`/`postgres`, host port **5433** → container port 5432 — 5432 is remapped because something else on this machine intercepts host port 5432; adjust back to `5432:5432` if that's not an issue on your machine).

(`migrate:down` reverts the last migration, `migrate:create -- <name>` scaffolds a new one.)


## Backend

```powershell
npm run dev:backend
```

Starts the Express server (via `tsx watch`) at `http://127.0.0.1:3000`. It binds to loopback only; it is not exposed to devices on the LAN. Health check: `GET http://127.0.0.1:3000/api/health` → `{ "status": "ok" }`.

The backend loads `backend/.env` relative to its source module before initializing the PostgreSQL pool, so the workspace script can be run from the repository root. It checks expired phase deadlines every 15 seconds. Missing player actions become server-generated `skip` entries and resolve automatically.

## Frontend

```powershell
npm run dev:frontend
```

Starts the Vite dev server at `http://127.0.0.1:5173`. It binds to loopback only. Requests to `/api/*` are proxied to `http://127.0.0.1:3000` (see `frontend/vite.config.ts`), so run the backend alongside it.
The 21 gang portrait images are served from `frontend/public/characters/` at `/characters/character_NN.png`.

### iPhone over Wi-Fi

To open the test instance on an iPhone, connect the computer and phone to the same trusted Wi-Fi network. Start the backend as usual. If the regular frontend server is already running, stop it with `Ctrl+C`, then start Vite in LAN mode:

```powershell
npm run dev:frontend:lan
```

On the computer, run `ipconfig` and find the IPv4 address for its Wi-Fi adapter (for example, `192.168.1.25`). On the iPhone, open `http://<computer-ip>:5173/` in Safari, replacing `<computer-ip>` with that address. Vite proxies `/api/*` to the backend, so the backend can remain bound to loopback and port 3000 does not need to be exposed.

If Windows Firewall prompts you, allow Node.js on **Private networks** only. If the page still cannot connect, allow inbound TCP port 5173 on the Private profile and make sure the Wi-Fi network does not isolate devices from one another. Stop the LAN server with `Ctrl+C` when finished; the regular `npm run dev:frontend` command remains loopback-only.

LAN mode listens on all network interfaces. The Vite development server is not intended for untrusted networks, so use it only on a trusted private network and stop it when done.

### Android Emulator without LAN access

With the emulator and both local servers running, forward the frontend port through ADB:

```powershell
adb reverse tcp:5173 tcp:5173
```

Open `http://localhost:5173/` in Chrome inside the emulator. Vite proxies API requests to the local backend, so only port 5173 needs forwarding. Remove the forwarding when finished with `adb reverse --remove tcp:5173`.

## Running both together

After PostgreSQL is running and migrations are applied, open two terminals at the repository root:

Terminal 1:
```powershell
npm run dev:backend
```

Terminal 2:
```powershell
npm run dev:frontend
```

Open the game at `http://127.0.0.1:5173/`. The API health check is `http://127.0.0.1:3000/api/health`.

Stop each development server with `Ctrl+C`. Stop PostgreSQL when needed with `docker compose down` (this keeps the database volume and its data).

## Environment variables

`backend/.env` (copy from `backend/.env.example`, never commit the real file — it's git-ignored):
```
DATABASE_URL=postgres://postgres:postgres@localhost:5433/gangwars
JWT_SECRET=dev-only-secret-change-me
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=pick-a-local-password
```

Players need no account: open `http://127.0.0.1:5173/`, enter a gang name, and you are in the lobby. Log in as admin from the same front page with `ADMIN_USERNAME`/`ADMIN_PASSWORD` (admin login is disabled while `ADMIN_PASSWORD` is empty) to see the players, create games, and start them. Run `npm run migrate:up` in `backend/` after pulling to apply the passwordless-players migration.

## Lint & test

```powershell
npm run lint          # lints backend + frontend
npm run test:backend  # runs backend vitest suite
```

Backend unit tests (`backend/test/`) don't require Docker/Postgres to be running — they operate on the Express app in-process (see `backend/test/health.test.ts`).
