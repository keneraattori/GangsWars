# Roadmap

Built in small, independently-shippable milestones. Each milestone should be its own branch/PR (or a short series of small PRs) — see [CONTRIBUTING.md](CONTRIBUTING.md) for batch-size guidance. Don't start a milestone until the prior one is merged and working.

## M0 — Repo & tooling scaffold ✅
- Initialize `frontend/` (React + Vite) and `backend/` (Express + TS or JS, project's choice) with linting/formatting configured.
- `docker-compose.yml` for local Postgres.
- Empty health-check endpoint (`GET /api/health`) proven working end-to-end locally.

## M1 — Auth ✅
- `users` table + migration.
- Register / login / logout endpoints, JWT cookie auth.
- Minimal React Login/Register pages wired to the API.

## M2 — Game & Gang creation ✅
- `games`, `game_members`, `gangs`, and `turfs` tables.
- Authenticated endpoints to create/join/start a game with a chosen lobby size (2–8 players, per [GAME_DESIGN.md](GAME_DESIGN.md)).
- On game start, create 20 `turfs` rows with unique random names from [TURF_NAMES.md](TURF_NAMES.md).
- Gang creation form (name input) → shows starting stats (10,000 / 20 / 0).

## M3 — Read-only Gameboard
- `GET /api/games/:id` + Gameboard page showing round number, gangs + stats, neutral turf count.
- No actions yet — proves the board rendering pipeline.

## M4 — Phase 1 actions (submission only)
- `phase_actions` table + submit endpoint.
- Frontend action picker for Beef / Buzinezz / Show off! / Attack (target selection UI for Beef/Attack).
- "X/Y gangs submitted" indicator.

## M5 — Phase 1 resolution
- Pure `resolvePhase1()` service function + unit tests (seeded RNG).
- Attack damage applied to members; Beef/Buzinezz/Show off! bonuses stored for Phase 2 use.
- Action log written and rendered on the Gameboard.

## M6 — Phase 2 actions + resolution
- Earn / Expand / Recruit / Protect submission.
- `resolvePhase2()`: money/member/turf math, simultaneous Expand roll-offs, win-condition check (12 turfs).
- Turf ownership updates reflected on Gameboard; round increments; new Phase 1 begins.

## M7 — Phase timeout + full round loop polish
- Enforce the 10-minute phase timeout (`games.phase_deadline`); auto-resolve a phase for gangs that haven't submitted (per [GAME_DESIGN.md §1](GAME_DESIGN.md#1-core-loop)).
- Handle remaining minor items noted in [GAME_DESIGN.md §7](GAME_DESIGN.md#7-resolved-design-decisions) ("Still open").
- Basic notifications/UI polish for whose turn/phase it is.

## M8 — CI
- GitHub Actions workflow: install, lint, unit test on every PR for both `frontend/` and `backend/`.

## M9 — Azure deployment
- Provision Azure Static Web Apps + Azure Database for PostgreSQL (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- Convert `backend/` handlers to Azure Functions entry points (or confirm SWA "managed functions" wraps Express directly — evaluate at this milestone).
- GitHub Actions deploy workflow (SWA's official action) triggered on merge to `main`.

## M10+ — Future (explicitly out of scope for MVP)
- Real-time/interactive resolution (WebSockets/SignalR or Azure Web PubSub).
- Notoriety mechanic.
- Spectator mode, match history, multiple concurrent games per user.

## Working agreement for each milestone

1. Confirm any relevant Open Question from [GAME_DESIGN.md](GAME_DESIGN.md) before writing code for it.
2. Land it as one or more small PRs (see [CONTRIBUTING.md](CONTRIBUTING.md)) rather than one giant milestone-sized commit.
3. Manually verify locally (per [LOCAL_DEV.md](LOCAL_DEV.md)) before moving to the next milestone.
4. Only after M9 do we touch Azure — everything up to that point runs and is verified locally.
