# Data Model

Draft schema — reflects the decisions recorded in [GAME_DESIGN.md §7](GAME_DESIGN.md#7-resolved-design-decisions). All tables use `id UUID` primary keys unless noted.

## `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| username | text, unique | |
| email | text, unique | |
| password_hash | text | bcrypt/argon2 |
| created_at | timestamptz | |

## `games`
A single match/lobby.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| creator_user_id | uuid FK → users.id | creator can start the game |
| status | enum: `lobby`, `active`, `finished` | |
| max_players | int | 2–8, set at game creation |
| round_number | int, default 1 | |
| current_phase | enum: `phase1`, `phase2` | |
| phase_deadline | timestamptz, nullable | set when the current phase opens; phase auto-resolves 10 minutes after opening even if not all gangs submitted |
| winner_gang_id | uuid FK → gangs.id, nullable | set when a gang reaches 12 turfs |
| created_at | timestamptz | |
| started_at | timestamptz, nullable | set when the creator starts the game |

## `game_members`
Join records are separate from gangs so a user can join a lobby before naming their gang.
| Column | Type | Notes |
|---|---|---|
| game_id | uuid FK → games.id | |
| user_id | uuid FK → users.id | |
| joined_at | timestamptz | |
| primary key (game_id, user_id) | | one membership per user per game |

## `gangs`
One gang per user per game.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| game_id | uuid FK → games.id | |
| user_id | uuid FK → users.id | |
| name | text | user-provided |
| money | int, default 10000 | |
| members | int, default 20 | |
| notoriety | int, default 0 | |
| created_at | timestamptz | |
| unique (game_id, user_id) | | one gang per user per game |

## `turfs`
20 rows created per game at start, named from the [TURF_NAMES.md](TURF_NAMES.md) pool (random, unique per game, purely cosmetic).
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| game_id | uuid FK → games.id | |
| label | text | random unique name from the 100-name pool |
| owner_gang_id | uuid FK → gangs.id, nullable | null = neutral |

## `phase_actions`
One row per gang per phase per round — the player's submitted choice. M4 writes Phase 1 rows; Phase 2 rows use the same table later.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| game_id | uuid FK → games.id | |
| round_number | int | |
| phase | enum: `phase1`, `phase2` | |
| gang_id | uuid FK → gangs.id | |
| action | enum: `beef`,`buzinezz`,`show_off`,`attack`,`earn`,`expand`,`recruit`,`protect`,`skip` | `skip` is server-generated only when a phase deadline expires |
| target_gang_id | uuid FK → gangs.id, nullable | used by beef/attack/expand |
| target_turf_id | uuid FK → turfs.id, nullable | used by expand |
| submitted_at | timestamptz | |
| unique (game_id, round_number, phase, gang_id) | | one action per gang per phase |

## `action_results` (Action Log)
One row per resolved action — what the Gameboard displays. M5 writes these rows when the final Phase 1 action arrives.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| phase_action_id | uuid FK → phase_actions.id | |
| roll_result | jsonb | raw dice rolls, e.g. `{"dice": [3,5], "total": 8, "bonus": 2}` |
| outcome | jsonb | effect applied, e.g. `{"turf_captured": "t-7", "members_gained": 4}` |
| resolved_at | timestamptz | |

## Indexing notes
- Index `phase_actions (game_id, round_number, phase)` for fast "has everyone submitted?" checks.
- Index `turfs (game_id, owner_gang_id)` for gameboard queries.

## Cross-round lookups needed by the resolver
- **Beef/Buzinezz/Show off! bonuses**: when resolving a Phase 2 action, look up that gang's Phase 1 `phase_actions` row from the *same* round.
- **Protect penalty**: when resolving a Phase 1 Expand/Attack in round N, look up whether the target gang selected Protect in round **N-1**'s Phase 2 `phase_actions`.
- **Simultaneous Expand conflicts**: when multiple `phase_actions` in the same `(game_id, round_number, phase)` target the same `target_turf_id`, resolve via the roll-off described in [GAME_DESIGN.md](GAME_DESIGN.md) instead of independently.

## Migration strategy
TypeScript migration files under `backend/src/db/migrations/`, managed with `node-pg-migrate` (tracked via its `pgmigrations` table). Run with `npm run migrate:up` / `migrate:down` / `migrate:create` in `backend/` (see [LOCAL_DEV.md](LOCAL_DEV.md)). `users` table added at M1; `games`/`gangs`/`turfs`/`phase_actions`/`action_results` land at their respective milestones.
