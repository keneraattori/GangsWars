# API Contract

Current REST contract between `frontend/` and the local Express backend. The frontend uses relative `/api` URLs; Vite proxies these to Express during local development. Azure Functions hosting is not implemented.

Player routes expect the `gw_token` cookie issued by `POST /api/auth/enter`; admin routes expect the separate `gw_admin_token` cookie issued by `POST /api/admin/login`. Responses are JSON except the logout routes, which return an empty 204 response. Errors use `{ "error": string }` with an appropriate HTTP status code.

## Players (no login)

Players do not register or log in. Entering a gang name creates an anonymous player and puts them in the lobby.

### `POST /api/auth/enter`
Body: `{ "name": string }` — 3–30 characters (letters, numbers, spaces, `_ ' . ! & -`). The name becomes the player's gang name and must be unique (case-insensitive).
201 → sets the auth cookie, `{ "id": string, "username": string }`. 400 for an invalid name, 409 if the name is taken.

### `POST /api/auth/logout`
Player auth required. Removes the player (freeing the name) unless they are in a running game, and clears the cookie. 204.

### `GET /api/auth/me`
Player auth required. `{ "id": string, "username": string }`.

## Admin

Admin credentials come from the `ADMIN_USERNAME` (default `admin`) and `ADMIN_PASSWORD` environment variables. Login is disabled (503) until `ADMIN_PASSWORD` is set.

### `POST /api/admin/login`
Body: `{ "username": string, "password": string }`. 200 → sets the admin cookie, `{ "admin": true }`. 401 on wrong credentials. Rate limited.

### `POST /api/admin/logout`, `GET /api/admin/me`
Clear the admin cookie (204) / check the admin session (`{ "admin": true }` or 401).

### `GET /api/admin/players`
Admin auth required. All players in the lobby: `{ "players": [{ "id", "username", "joinedAt", "lastSeenAt", "online", "gameId" }] }`. `online` means the player was active in the last 90 seconds; `gameId` is the player's current non-finished game, if any.

### `DELETE /api/admin/players/:playerId`
Admin auth required. Removes a player. 409 if the player is in a running game. 204 on success.

### `GET /api/admin/games`, `POST /api/admin/games`
Admin auth required. List all games / create a lobby visible to every player. Create body: `{ "maxPlayers": 2 }` (integer 2–8). The admin is not a game member.

### `DELETE /api/admin/games`
Admin auth required. Permanently deletes every game and its dependent memberships, gangs, Turfs, actions, and results. Body must be `{ "confirmation": "DELETE_ALL_GAMES" }`.

### `GET /api/admin/games/:gameId`
Admin auth required. Same board payload as `GET /api/games/:gameId`, without requiring membership.

### `POST /api/admin/games/:gameId/start`
Admin auth required. Requires at least two joined players and a gang created by every joined player; creates 20 unique named neutral Turfs and activates the game. Returns 409 with a readiness message otherwise.

## Gangs

### `POST /api/games/:gameId/gangs`
Create the caller's gang in a game. Auth required.
Body: `{ "characterId": number }`, where `characterId` is 1–21 and required. The gang is named after the player (the gang name entered on the front page).
201 → the created gang summary, including `id`, `gameId`, `userId`, `name`, `money`, `members`, `notoriety`, `turfsHeld`, and `characterId`.
409 if the user already has a gang in this game or another gang in this game already uses the selected character. Character selections are unique per game, not globally.

### `GET /api/games/:gameId/me`
Auth required. Returns the caller's gang in this game (404 if none yet → frontend shows gang creation and available character portraits).

## Games / Lobby

### `GET /api/games/open`
Player auth required. Returns the lobbies created by the admin, with `id`, `maxPlayers`, `memberCount`, `gangCount`, and `status`. The frontend polls this endpoint every two seconds while showing the open-lobby list.

### `GET /api/games/mine`
Player auth required. `{ "game": GameSummary | null }` — the caller's current non-finished game, used to resume after a page reload.

### `POST /api/games/:gameId/join`
Auth required. Joins an open lobby. Joining only creates a `game_members` row; it does not create or reuse a gang. Returns 409 if the lobby is full, already started, or the caller has already joined it.

### `GET /api/games/:gameId`
Auth required and membership required. Returns the current game summary plus the full board: gangs (including `characterId`), Turfs and owner names, neutral Turf count, and resolved action log entries. The frontend polls the selected game every two seconds. Response shape:
```json
{
  "game": { "id": "...", "status": "active", "maxPlayers": 2, "memberCount": 2, "gangCount": 2, "roundNumber": 1, "currentPhase": "phase1", "phaseDeadline": "...", "winnerGangId": null },
  "gangs": [
    { "id": "...", "gameId": "...", "userId": "...", "name": "...", "money": 12000, "members": 22, "notoriety": 0, "turfsHeld": 3, "characterId": 4 }
  ],
  "turfs": [
    { "id": "...", "label": "Blackwater Docks", "ownerGangId": null, "ownerGangName": null }
  ],
  "neutralTurfs": 20,
  "actionLog": []
}
```

The returned `actionLog` entries include `roundNumber`, `phase`, `gangName`, `action`, `rollResult`, `outcome`, and `resolvedAt`.

### `GET /api/games/public/:gameId`
No authentication required. Read-only board payload for the `/gamerun/:gameId` projector page. Includes public gang standings, Turfs, phase timing, resolved action log, and aggregate `submittedCount` / `totalGangCount` progress. It omits player and membership identifiers and never returns choices submitted for a phase that has not resolved.

## Phase actions

### `POST /api/games/:gameId/actions`
Auth required. Submits the caller's action for the current phase.
Body:
```json
{ "action": "beef", "targetGangId": "..." }
```
For Phase 1, `action` is one of `beef`, `buzinezz`, `show_off`, or `attack`. Beef and Attack require a `targetGangId` belonging to another gang in the same game. For Phase 2, `action` is one of `earn`, `expand`, `recruit`, or `protect`; Expand requires a `targetTurfId`. 202 → `{ "accepted": true, "resolved": false, "status": { "submittedCount": 1, "totalGangCount": 2, "hasSubmitted": true, "submittedAction": "beef" } }`. `submittedAction` is the caller's own current selection; other gangs' choices remain private until resolution. The final submission returns `resolved: true` and advances to the next phase (or next round); reaching 12 Turfs finishes the game. If the 10-minute deadline expires first, the server creates non-selectable `skip` actions for missing gangs and resolves them with no effects. 409 if the caller already submitted this phase, or the action isn't valid for the current phase.

### `GET /api/games/:gameId/actions/status`
Returns current round/phase, submission counts, whether the caller submitted, and the caller's own `submittedAction` (null until submitted). It never reveals other gangs' choices.

## Notes for implementers

- Every mutating endpoint must validate: user is authenticated, user's gang belongs to `:gameId`, the action is legal for the current phase, and any `target*` id belongs to the same game. Gang creation also requires a free portrait ID in the 1–21 range; the database enforces per-game uniqueness.
- Phase resolution runs server-side once all gangs submit, **or** when the 10-minute `phase_deadline` elapses (see [GAME_DESIGN.md §1](GAME_DESIGN.md#1-core-loop) and [DATA_MODEL.md](DATA_MODEL.md)). For local MVP testing, a background check after each submission (and a scheduled/poll-based deadline check) is sufficient — no dedicated client-triggered "resolve" endpoint is needed.
