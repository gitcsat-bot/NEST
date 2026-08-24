# NEST — Networked Equipment & Stock Tracker

This repository is the implementation of the design documented in `docs/` (copied in from the
approved planning set): PRD, System Instructions, ADR, Technical Design Specification, Database
Design, API Contract, UI/UX Specification, Security Design, and the finalized Implementation Plan.

**Status:** Phase 0 (Foundations) in progress — see `NEST_Implementation_Plan_Final.md` §3 for the
exact workstream list and exit gate. This scaffold currently implements: repo/tooling structure,
the Prisma schema for the auth/session/audit tables, and the auth core (login, 2FA verification
scaffold, password reset, session guard, roles guard, step-up guard, and the Users module's
role-change/deactivate/reactivate endpoints). Domain modules (locations, assets, inventory,
checkouts, ...) are intentionally not yet scaffolded — see the note at the bottom of
`apps/backend/prisma/schema.prisma` for why.

## Layout

Matches the Repository Structure in the ADR document exactly:

```
apps/backend/    NestJS API (the modular monolith, ADR-001/ADR-002)
apps/frontend/   React + TypeScript SPA (ADR-003)
packages/shared-types/   DTOs and enums shared between both
infra/docker/    docker-compose topology (ADR-007/ADR-010)
docs/            design documents (this project's paper trail)
.github/workflows/   CI (Implementation Plan §3, §7)
```

## Before you run anything

1. Read `apps/backend/.env.example` and `apps/frontend/.env.example` and create real `.env` files
   locally (never commit them — Security Design §10).
2. This scaffold has **not** had `pnpm install` run against it in this environment — dependencies
   are declared in each `package.json` but not fetched/vendored here. Run `pnpm install` from the
   repo root first.
3. Start local infrastructure: `docker compose -f infra/docker/docker-compose.dev.yml up -d`
4. Generate the Prisma client and run the first migration:
   ```
   pnpm --filter @nest/backend prisma:generate
   pnpm --filter @nest/backend prisma:migrate:dev
   ```
   The Database Design §7 grant statements (`REVOKE UPDATE, DELETE ON audit_log`, etc.) are **not**
   yet expressed as a migration in this scaffold — Prisma can't generate GRANT/REVOKE from
   `schema.prisma`. Add them as a raw-SQL migration (`prisma migrate dev --create-only`, then hand-edit
   the generated `migration.sql`) before this is exercised against anything beyond a local dev
   database — this is called out explicitly so it isn't missed. Security Acceptance Criterion #12
   depends on it.
5. `pnpm --filter @nest/backend prisma:generate && pnpm dev:backend` / `pnpm dev:frontend` to run
   both apps locally.

## What's deliberately not done yet

- `decryptTotpSecret` / recovery-code consumption in `auth.service.ts` are stubbed with a clear
  `throw` rather than a fake implementation — see the Implementation Plan's "2FA core" workstream.
  Do not treat the current `AuthService` as launch-ready; the login/logout/password-reset paths are
  functionally complete against the design docs, 2FA verification is not yet.
- The `nest_app` / `nest_migrator` grant split (step 4 above) is written up in the Database Design
  but not yet applied as a migration.
- The worker process (BullMQ/Redis, ADR-008), locations/assets/inventory modules, and the rest of
  the frontend beyond the Login screen are Phase 1 scope per the Implementation Plan and are not in
  this scaffold.
- No tests are included yet. The CI workflow runs `pnpm test` against an empty suite — the first
  real test coverage lands with the first real feature workstream, per Implementation Plan §7.

## Traceability

Every non-trivial line of code in this scaffold has a comment pointing back to the specific design
document section it implements. If you find code here that doesn't trace to one of the approved
documents, that's a bug in the implementation, not an intentional addition — raise it rather than
building on top of it.

## Production Deployment Guide

To deploy NEST on a production Windows server or environment using CMD, follow these steps:

### 1. Prerequisites
- **Node.js**: Install Node.js (v18 or v20).
- **PostgreSQL**: Install PostgreSQL (v14+).
- **PM2**: Install PM2 globally (`npm install -g pm2`).
- **Nginx (or IIS)**: Install a reverse proxy to handle SSL and routing (e.g., download Nginx for Windows).

### 2. Database Setup
Create a PostgreSQL database and a user for the application. Set up the `APP_DATABASE_URL` and `DATABASE_URL` environment variables according to the `.env.example` specifications. Ensure the migrations and seeding are run via CMD:
```cmd
pnpm --filter @nest/backend prisma:generate
pnpm --filter @nest/backend prisma:migrate:deploy
```

### 3. Build the Application
Clone the repository and build the monorepo:
```cmd
pnpm install
pnpm -r build
```

### 4. Running the Backend
Use PM2 to start the backend application in the background:
```cmd
cd apps\backend
pm2 start dist\main.js --name "nest-backend"
pm2 save
```
*(Consider using `pm2-windows-service` to ensure it starts on server reboot.)*

### 5. Serving the Frontend
Configure your reverse proxy (e.g., Nginx) to serve the static files from `apps/frontend/dist` on the root domain (`/`), and proxy all `/api/` requests to `http://localhost:3000/` (or whichever port the NestJS backend is running on).

---

## Phase 2 Implementation Plan

Phase 2 will focus on extending the core inventory and administrative capabilities:

1. **Barcode & QR Code Integration**
   - Implement rendering of unique QR codes for Asset Instances and Locations.
   - Add a frontend scanner capability using the device camera to quickly check-in/check-out items or view details.

2. **Advanced Reporting & Exports**
   - Build a comprehensive Reports dashboard for Admins.
   - Support exporting inventory logs, checkout history, and audit trails to CSV/Excel formats.
   - Generate "Low Stock" alerts and depreciation reports.

3. **Fine-Grained Role-Based Access Control (RBAC)**
   - Introduce custom permission sets rather than the fixed `VIEWER/STUDENT/CONTRIBUTOR/ADMIN` hierarchy.
   - Allow delegation of specific module administration (e.g., "Catalog Manager" vs "Location Manager").

4. **Integration with External Identity Providers (SSO)**
   - Support OAuth2/SAML logins (e.g., Google Workspace, Microsoft Entra ID) to simplify the onboarding process for enterprise and educational environments.
