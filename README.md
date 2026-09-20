# Gang Turf Wars

A multiplayer browser game where players register, log in, create a gang, and battle other gangs to capture **Turfs**. First gang to control 12 Turfs wins.

This repository is currently in the **planning stage**. No application code has been written yet — see [docs/](docs/) for the full design and rollout plan.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React |
| Backend | Node.js + Express (local) → Azure Functions (deployed) |
| Database | PostgreSQL (Azure Database for PostgreSQL in the cloud, Docker locally) |
| Hosting | Azure Static Web Apps (free tier) + managed Azure Functions |
| CI/CD | GitHub Actions |

## Where to start

1. [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — full rules: gangs, turfs, phases, actions, formulas
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, local vs. Azure topology
3. [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — database schema
4. [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — REST endpoints between frontend and backend
5. [docs/ROADMAP.md](docs/ROADMAP.md) — milestone-by-milestone build order (small batches)
6. [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) — how to run everything on your machine
7. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — how it ships to Azure
8. [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — working principles for humans and AI agents in this repo

## Project layout (target state)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#repository-layout) for the annotated folder tree. Folders are created empty (with `.gitkeep`) until the corresponding roadmap milestone fills them in.
