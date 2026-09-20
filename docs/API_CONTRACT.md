# API Contract

Draft REST contract between `frontend/` and `backend/`. Same routes work against the local Express server and Azure Functions (both mounted under `/api`).

All authenticated routes expect the auth cookie set by `/api/auth/login`. All responses are JSON. Errors use `{ "error": string }` with an appropriate HTTP status code.

## Auth

### `POST /api/auth/register`
Body: `{ "username": string, "email": string, "password": string }`
201 → `{ "id": string, "username": string }`

### `POST /api/auth/login`
Body: `{ "username": string, "password": string }`
200 → sets auth cookie, `{ "id": string, "username": string }`

### `POST /api/auth/logout`
200 → clears auth cookie

## Gangs

### `POST /api/games/:gameId/gangs`
Create the caller's gang in a game. Auth required.
Body: `{ "name": string }`
201 → `{ "id": string, "name": string, "money": 10000, "members": 20, "notoriety": 0 }`
409 if the user already has a gang in this game.

### `GET /api/games/:gameId/me`
Auth required. Returns the caller's gang in this game (404 if none yet → frontend shows gang creation).

## Games / Lobby

### `GET /api/games/open`
Auth required. Returns open lobby summaries with `id`, `maxPlayers`, `memberCount`, `gangCount`, and `status`.

### `POST /api/games`
Auth required. Creates a lobby and automatically joins the creator.
Body: `{ "maxPlayers": 2 }` where `maxPlayers` is an integer from 2 through 8.

### `POST /api/games/:gameId/join`
Auth required. Joins an open lobby. Returns 409 if the lobby is full or already started.

### `POST /api/games/:gameId/start`
Auth required. Creator-only. Requires at least two joined players, creates 20 unique named neutral Turfs, and activates the game.

### `GET /api/games/:gameId`
Auth required and membership required. Returns the current lobby/game summary. Full board data lands in M3.

## Games / Gameboard

### `GET /api/games/:gameId` (M3 response)
Auth and game membership required. Returns:
```json
{
  "game": { "id": "...", "status": "active", "roundNumber": 1, "currentPhase": "phase1", "memberCount": 2, "gangCount": 2 },
  "gangs": [
    { "id": "...", "name": "...", "money": 12000, "members": 22, "notoriety": 0, "turfsHeld": 3 }
  ],
  "turfs": [
    { "id": "...", "label": "Blackwater Docks", "ownerGangId": null, "ownerGangName": null }
  ],
  "neutralTurfs": 20
}
```

### `GET /api/games/:gameId/log?round=2`
Returns resolved `action_results` for the given round (or all rounds if omitted), for the Gameboard's action log.

## Phase actions

### `POST /api/games/:gameId/actions`
Auth required. Submits the caller's action for the current phase.
Body:
```json
{ "action": "beef", "targetGangId": "..." }
```
For M4 Phase 1, `action` is one of `beef`, `buzinezz`, `show_off`, or `attack`. Beef and Attack require a `targetGangId` belonging to another gang in the same game. 202 → `{ "accepted": true, "resolved": false, "status": { "submittedCount": 1, "totalGangCount": 2, "hasSubmitted": true } }`. The final submission returns `resolved: true` and advances the game to Phase 2. 409 if the caller already submitted this phase, or the action isn't valid for the current phase.

### `GET /api/games/:gameId/actions/status`
Returns current round/phase and which gangs have submitted for the current phase (counts and the caller's own boolean only, never the choices) so the frontend can show "1/2 gangs ready".

## Notes for implementers

- Every mutating endpoint must validate: user is authenticated, user's gang belongs to `:gameId`, the action is legal for the current phase, and any `target*` id belongs to the same game.
- Phase resolution runs server-side once all gangs submit, **or** when the 10-minute `phase_deadline` elapses (see [GAME_DESIGN.md §1](GAME_DESIGN.md#1-core-loop) and [DATA_MODEL.md](DATA_MODEL.md)). For local MVP testing, a background check after each submission (and a scheduled/poll-based deadline check) is sufficient — no dedicated client-triggered "resolve" endpoint is needed.
