# Deployment (Azure)

Planned for milestone M9 — nothing here should be provisioned before then. This is the target plan, refined once M9 starts.

## Azure resources

| Resource | Purpose | Tier |
|---|---|---|
| Azure Static Web Apps | Hosts the built React app + wraps `backend/functions` as its managed API | Free tier |
| Azure Database for PostgreSQL (Flexible Server) | Production database | Burstable/lowest-cost tier |

## GitHub Actions

- **`ci.yml`**: on every PR — install deps, lint, run unit tests for `frontend/` and `backend/`. Must pass before merge.
- **`deploy.yml`**: on merge to `main` — uses the official `Azure/static-web-apps-deploy` action to build `frontend/` and deploy `backend` as the SWA-managed API. Triggered only after `ci.yml` passes.

## Secrets (GitHub repo secrets, never committed)

- `AZURE_STATIC_WEB_APPS_API_TOKEN` — deployment token from the SWA resource.
- `DATABASE_URL` — connection string for the Azure Postgres instance, set as an SWA application setting (not baked into the frontend bundle).
- `JWT_SECRET` — set as an SWA application setting.

## Migration path local → Azure

1. Confirm `backend/` handlers are structured so `functions/` entry points are thin adapters calling the same `services/` used by the local Express app (see [ARCHITECTURE.md](ARCHITECTURE.md)).
2. Point `DATABASE_URL` at the Azure Postgres instance; run migrations against it (same migration files used locally).
3. Deploy via GitHub Actions; verify `/api/health` and a manual login/gang-creation smoke test in production.

## Rollback

Azure Static Web Apps keeps prior deployments; GitHub Actions history + `git revert` on `main` is the rollback path — no manual portal changes.
