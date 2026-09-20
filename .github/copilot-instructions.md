---
description: "Repo-wide guidelines for Gang Turf Wars"
---

# Gang Turf Wars — Agent Instructions

## What this project is
A multiplayer gang/turf-war browser game. React frontend, Node.js/Express backend (deployed as Azure Functions), PostgreSQL database. Full design lives in [docs/GAME_DESIGN.md](../docs/GAME_DESIGN.md); architecture in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md); build order in [docs/ROADMAP.md](../docs/ROADMAP.md).

## Working style (read this before writing code)
- Work in **small batches**: implement one roadmap milestone step at a time, not several at once. See [docs/ROADMAP.md](../docs/ROADMAP.md) and [docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md).
- Keep game-rule logic in small, pure, framework-free functions under `backend/src/services/` — never mix Express/Functions request handling with rule logic.
- RNG must be injectable/seedable, never a bare `Math.random()` inside a service — needed for deterministic unit tests.
- Don't guess on ambiguous game rules — check [docs/GAME_DESIGN.md#open-questions](../docs/GAME_DESIGN.md) and ask the user first.

## Build & test
Not yet scaffolded (repo is pre-M0). Once `frontend/` and `backend/` are initialized, commands will be documented in [docs/LOCAL_DEV.md](../docs/LOCAL_DEV.md) — keep that file current whenever commands change.

## Security
- Parameterized SQL only, never string-concatenated queries.
- Hash passwords (bcrypt/argon2); never log secrets or passwords.
- Validate all input server-side, even if also validated client-side.
- See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) security notes section.
