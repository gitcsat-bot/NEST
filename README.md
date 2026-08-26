# NEST — Networked Equipment & Stock Tracker

**COEP Satellite Initiative — Internal Virtual Warehouse & Physical Asset Management System**

NEST is a purpose-built, internally hosted web application that provides the COEP Satellite Initiative with a single, authoritative digital record of every physical asset it owns or holds. From RF connectors and ICs to oscilloscopes and flight-candidate PCB assemblies, NEST replaces spreadsheets, group chats, and institutional memory with a searchable, auditable, and role-gated system of record.

---

## Key Features

- **Comprehensive Inventory Tracking**: Track serialized/individually-tracked assets and bulk quantity-based inventory in one unified system.
- **Robust Role-Based Access Control (RBAC)**: Enforce security with role-based permissions (`viewer`, `contributor`, `stores_manager`, `admin`).
- **Complete Auditability**: Append-only audit logs track every action.
- **Secure File Attachments**: Upload datasheets, certificates, and photos directly to asset records.
- **Flexible Location Hierarchy**: Organize assets dynamically across warehouses, rooms, racks, shelves, and bins.
- **Lifecycle Management**: Check-out, check-in, transfer, reserve, report damage, repair, and retire assets.
- **Two-Factor Authentication (TOTP)**: Built-in 2FA for enhanced account security.
- **Neumorphism Design**: Modern, clean, and interactive user interface.

---

## Architecture & Tech Stack

- **Frontend**: React (SPA), TypeScript, Tailwind CSS
- **Backend API**: NestJS, TypeScript, Prisma ORM
- **Database**: PostgreSQL (Relational Data & Audit Logs)
- **Object Storage**: MinIO (Secure Attachments)
- **Caching & Job Queue**: Redis & BullMQ (Background jobs)
- **Security**: ClamAV (Antivirus), Argon2id (Password Hashing)

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

### 3. Quick Start (Windows)
We provide an automated script to start the entire stack, including dependencies, Docker containers, database migrations, backend, and frontend.

Simply run:
```bat
.\run.bat
```

Alternatively, you can manually run the stack:
```bash
# 1. Install all monorepo dependencies
pnpm install

# 2. Start PostgreSQL and MinIO in the background
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 3. Generate and migrate the database schema
pnpm run prisma:generate
pnpm --filter @nest/backend prisma:migrate:dev

# 4. Start the backend server (Terminal 1)
pnpm run dev:backend

# 5. Start the frontend server (Terminal 2)
pnpm run dev:frontend
```

---

## Recent Feature Additions
- **Bulk CSV Importing:** Automatically import and update physical inventory records directly from standard `.csv` spreadsheets.
- **Dynamic Theming Support:** Automatically matches the user's OS preference for Light/Dark mode during login/registration, and supports custom user overrides via settings.

---

## Contributors

- [Lakshya Varshney](https://github.com/lakshyaV-rshney)

