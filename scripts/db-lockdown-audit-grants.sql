-- Run this once, manually, after `prisma migrate dev` has created the
-- schema (audit_log, inventory_transactions, etc. must already exist).
-- Database Design §7 / Security Design §17 Criterion #12: the runtime
-- role must not be able to UPDATE or DELETE the append-only tables, at
-- the grant level, not just by application-code convention.
--
-- Run with:
--   psql "$NEST_MIGRATOR_DATABASE_URL" -f scripts/db-lockdown-audit-grants.sql
--
-- Idempotent — safe to re-run after every migration that touches these
-- tables, in case a future migration recreates them.

REVOKE UPDATE, DELETE ON audit_log FROM nest_app;
-- inventory_transactions doesn't exist yet in this Phase 0 scaffold
-- (Phase 1 workstream — see prisma/schema.prisma's closing note). This
-- line is here so it isn't forgotten when that table lands:
-- REVOKE UPDATE, DELETE ON inventory_transactions FROM nest_app;
