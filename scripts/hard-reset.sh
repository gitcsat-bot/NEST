#!/usr/bin/env bash
set -euo pipefail

# NEST — hard reset for local development.
#
# Tears down everything a normal `git clean` wouldn't safely touch:
# Docker containers/volumes, installed dependencies, build output, and
# the generated Prisma client. Run this when the local environment is in
# a state you don't trust (stale roles/grants, a half-applied migration,
# a dependency install that went wrong) and you want to start clean.
#
# What this script does NOT do, on purpose:
#   - Delete apps/backend/prisma/migrations/ — your migration history is
#     source-controlled intent, not local state. Deleting it is a much
#     bigger decision than "reset my dev environment" and is left to a
#     separate, explicit step (see the printed note at the end).
#   - Touch your .env files — they hold secrets you generated yourself
#     (Security Design §10); regenerating them isn't part of a "reset."
#   - Run with sudo or touch anything outside this repo.
#
# Usage: ./scripts/hard-reset.sh   (from anywhere; resolves repo root itself)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "== NEST hard reset =="
echo "Repo root: $REPO_ROOT"
echo

read -r -p "This stops Docker containers, deletes their volumes (all local DB/MinIO data), and removes all node_modules/build output. Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo
echo "-- Stopping Docker services and deleting volumes --"
if command -v docker &> /dev/null; then
  docker compose -f infra/docker/docker-compose.dev.yml down -v || true
else
  echo "Docker not found — skipping (nothing to tear down if you're on a native Postgres install)."
fi

echo
echo "-- Removing node_modules (root + every workspace package) --"
rm -rf node_modules
rm -rf apps/backend/node_modules
rm -rf apps/frontend/node_modules
rm -rf packages/shared-types/node_modules

echo
echo "-- Removing build output --"
rm -rf apps/backend/dist
rm -rf apps/frontend/dist
rm -rf packages/shared-types/dist

echo
echo "-- Removing the generated Prisma client --"
rm -rf apps/backend/generated

echo
echo "== Reset complete =="
echo
echo "Next steps (see README.md 'Setup'):"
echo "  1. pnpm install"
echo "  2. docker compose -f infra/docker/docker-compose.dev.yml up -d"
echo "  3. Confirm .env files exist (this script did not touch them):"
echo "       apps/backend/.env   (from apps/backend/.env.example)"
echo "       apps/frontend/.env  (from apps/frontend/.env.example)"
echo "  4. pnpm --filter @nest/backend prisma:generate"
echo "  5. pnpm --filter @nest/backend prisma:migrate:dev"
echo "  6. psql \"\$DATABASE_URL\" -f scripts/db-lockdown-audit-grants.sql"
echo "  7. pnpm --filter @nest/backend prisma db seed"
echo "  8. pnpm dev:backend   (separate terminal: pnpm dev:frontend)"
echo
echo "NOTE: this script left apps/backend/prisma/migrations/ untouched. If you"
echo "specifically want to reset the SCHEMA too (not just the running database),"
echo "that's a separate, more destructive step — delete that directory yourself"
echo "and re-run 'prisma migrate dev' to regenerate migration history from"
echo "schema.prisma, only if you're certain no one else depends on the existing"
echo "migration history."
