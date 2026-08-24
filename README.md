# NEST — Networked Equipment & Stock Tracker

**COEP Satellite Initiative — Internal Virtual Warehouse & Physical Asset Management System**

NEST is a purpose-built, internally hosted web application that provides the COEP Satellite Initiative with a single, authoritative digital record of every physical asset it owns or holds. From RF connectors and ICs to oscilloscopes and flight-candidate PCB assemblies, NEST replaces spreadsheets, group chats, and institutional memory with a searchable, auditable, and role-gated system of record.

---

## Key Features

- **Comprehensive Inventory Tracking**: Track serialized/individually-tracked assets (e.g., test instruments) and bulk quantity-based inventory (e.g., resistors) in one unified system.
- **Robust Role-Based Access Control (RBAC)**: Enforce security with role-based permissions (`viewer`, `contributor`, `stores_manager`, `admin`) and step-up verification for sensitive operations.
- **Complete Auditability**: Append-only audit logs track every action—who did what, when, and from where.
- **Secure File Attachments**: Upload datasheets, certificates, and photos directly to asset records, complete with automated malware scanning and secure authenticated downloads.
- **Flexible Location Hierarchy**: Organize assets dynamically across warehouses, rooms, racks, shelves, and bins.
- **Lifecycle Management**: Check-out, check-in, transfer, reserve, report damage, repair, and retire assets with clear status transitions.
- **Two-Factor Authentication (TOTP)**: Built-in 2FA for enhanced account security.

---

## Architecture & Tech Stack

NEST is built using a modern, scalable, and secure technology stack:

- **Frontend**: React (SPA), TypeScript
- **Backend API**: NestJS, TypeScript, Prisma ORM
- **Database**: PostgreSQL (Relational Data & Audit Logs)
- **Object Storage**: MinIO (Secure Attachments)
- **Caching & Job Queue**: Redis & BullMQ (Background jobs)
- **Security**: ClamAV (Antivirus), Argon2id (Password Hashing)
- **Reverse Proxy**: Caddy / Nginx

---

## Project Structure

This repository is structured as a monorepo managing both frontend and backend codebases:

```text
nest/
├── apps/
│   ├── backend/            # NestJS API (the modular monolith)
│   └── frontend/           # React + TypeScript SPA
├── packages/
│   └── shared-types/       # DTOs and enums shared between frontend and backend
├── infra/
│   └── docker/             # Docker Compose topologies for dev & prod
├── docs/                   # Design documents, PRD, TDS, and Implementation Plans
├── .github/workflows/      # CI/CD pipelines
└── README.md
```

---

## Getting Started (Local Development)

### 1. Prerequisites
- Node.js (v18 or v20)
- pnpm (v8+)
- Docker & Docker Compose

### 2. Environment Setup
Create local `.env` files based on the provided examples. **Never commit these files.**
```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

### 3. Install Dependencies
Run this from the repository root:
```bash
pnpm install
```

### 4. Start Infrastructure Services
Start the required local services (PostgreSQL, Redis, MinIO, ClamAV) via Docker:
```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

### 5. Database Initialization
Generate the Prisma client and run the development migrations:
```bash
pnpm --filter @nest/backend prisma:generate
pnpm --filter @nest/backend prisma:migrate:dev
```
*(Note: Ensure you apply the raw SQL grants for the `audit_log` as specified in the Database Design docs).*

### 6. Run the Application
Start both the backend and frontend in development mode:
```bash
# Terminal 1: Start the NestJS API
pnpm dev:backend

# Terminal 2: Start the React Frontend
pnpm dev:frontend
```

---

## Production Deployment

To deploy NEST on a production environment (e.g., Windows Server or Linux):

1. **Database & Infrastructure**: Ensure PostgreSQL and Nginx/IIS are running.
2. **Migrations**: Apply production migrations:
   ```bash
   pnpm --filter @nest/backend prisma:generate
   pnpm --filter @nest/backend prisma:migrate:deploy
   ```
3. **Build**:
   ```bash
   pnpm install
   pnpm -r build
   ```
4. **Run Backend (via PM2)**:
   ```bash
   cd apps/backend
   pm2 start dist/main.js --name "nest-backend"
   pm2 save
   ```
5. **Serve Frontend**: Configure your reverse proxy to serve `apps/frontend/dist` on the root domain and proxy `/api/` requests to the backend.

---

## Documentation Reference

All architectural decisions, system requirements, and API contracts are thoroughly documented in the `docs/` directory:
- `docs/planning/NEST_PRD.md` - Product Requirements Document
- `docs/planning/NEST_Technical_Design_Specification.md` - TDS
- `docs/planning/NEST_Security_Design.md` - Security & Threat Model
- `docs/planning/NEST_Implementation_Plan_Final.md` - Execution Strategy

*(Traceability: Every non-trivial line of code in this scaffold has a comment pointing back to the specific design document section it implements.)*
