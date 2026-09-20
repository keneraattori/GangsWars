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

### `GET /api/games/:gameId/gangs/me`
Auth required. Returns the caller's gang in this game (404 if none yet → frontend routes to gang-creation).

## Games / Gameboard

### `GET /api/games/:gameId`
Public within the game's players. Returns full board state:
```json
{
  "id": "...",
  "status": "active",
  "roundNumber": 2,
  "currentPhase": "phase1",
  "gangs": [
    { "id": "...", "name": "...", "money": 12000, "members": 22, "notoriety": 0, "turfsHeld": 3 }
  ],
  "neutralTurfs": 14,
  "winnerGangId": null
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
or `{ "action": "expand", "targetTurfId": "..." }` — works the same whether the target turf is neutral or owned by another gang (turfs are individually named/identified per [DATA_MODEL.md](DATA_MODEL.md) and [TURF_NAMES.md](TURF_NAMES.md); the server looks up the turf's current owner to decide which capture formula applies).
202 → `{ "accepted": true }`. 409 if the caller already submitted this phase, or the action isn't valid for the current phase.

### `GET /api/games/:gameId/actions/status`
Returns which gangs have submitted for the current phase (booleans only, not the choices) so the frontend can show "3/5 gangs ready".

## Notes for implementers

- Every mutating endpoint must validate: user is authenticated, user's gang belongs to `:gameId`, the action is legal for the current phase, and any `target*` id belongs to the same game.
- Phase resolution runs server-side once all gangs submit, **or** when the 10-minute `phase_deadline` elapses (see [GAME_DESIGN.md §1](GAME_DESIGN.md#1-core-loop) and [DATA_MODEL.md](DATA_MODEL.md)). For local MVP testing, a background check after each submission (and a scheduled/poll-based deadline check) is sufficient — no dedicated client-triggered "resolve" endpoint is needed.
