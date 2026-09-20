# Contributing / Working Principles

This project is being built with heavy AI-assistant involvement, so these principles matter more than usual. Both human contributors and AI coding agents should follow them.

## 1. Small Batches & Continuous Integration

- Implement **one milestone step at a time** (see [ROADMAP.md](ROADMAP.md)), not multiple milestones in one go.
- Prefer several small PRs over one large PR. A good PR is reviewable in a few minutes and touches one concern (e.g., "add `resolvePhase1` service + tests", not "add all phase 1 and 2 logic + UI").
- Every PR should be able to build, lint, and pass tests on its own (`ci.yml`) — don't leave the repo in a broken state between PRs.
- After generating a chunk of AI-written code, stop and run it locally before asking for the next chunk. Fast feedback loops beat large speculative code dumps.

## 2. Modular Architecture

- Game rules live in small, pure, framework-free functions under `backend/src/services/` — no Express/Functions request objects inside them. This keeps each module small enough to reason about and to hand to an AI agent as a self-contained task ("implement `resolveExpand(gang, target, roll)`", not "implement the whole phase 2 resolver").
- RNG is injected, not called directly, so modules stay unit-testable and deterministic in tests.
- Keep `shared/` (types/constants used by both frontend and backend) as the single source of truth for action names, enums, etc. — don't duplicate literals across the codebase.
- Prefer many small files with a clear single responsibility over few large files.

## 3. When asking an AI agent for a change

- Give it one module/component/endpoint at a time. Reference the exact doc (`GAME_DESIGN.md`, `DATA_MODEL.md`, `API_CONTRACT.md`) it should follow rather than re-explaining rules ad hoc.
- If a rule is ambiguous, check [GAME_DESIGN.md#open-questions](GAME_DESIGN.md#open-questions) first — resolve the question with the user before letting the agent guess.
- Ask for tests alongside any `services/` logic change.

## 4. Code review checklist (human or AI self-review before merging)

- [ ] Matches the relevant doc in `docs/` (or the doc was updated alongside the code)
- [ ] No secrets committed; `.env` respected
- [ ] Input validated server-side on any new/changed endpoint
- [ ] Parameterized SQL only
- [ ] Unit tests added/updated for `services/` changes
- [ ] `docs/ROADMAP.md` checkbox/milestone updated if a milestone is completed

## 5. Commit style

Short, imperative commit messages (`Add gang creation endpoint`, not `Added stuff for gangs`). One logical change per commit where practical.
