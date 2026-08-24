-- Runs automatically on first container start (mounted into
-- /docker-entrypoint-initdb.d/ by docker-compose.dev.yml). Executed as the
-- POSTGRES_USER from the compose file (nest_migrator), which owns the
-- database and will later own every table Prisma creates.
--
-- Database Design §7: nest_app is the runtime, least-privilege role — no
-- DDL rights. ALTER DEFAULT PRIVILEGES (rather than a one-time GRANT ON
-- ALL TABLES) is used deliberately: it applies automatically to tables
-- created *after* this script runs, which matters here because this
-- script runs before `prisma migrate dev` has created any tables at all.
-- Without this, every future `prisma migrate dev` would need a manual
-- follow-up grant, which is exactly the kind of step a rotating team
-- forgets (Implementation Plan §9 risk register).

CREATE ROLE nest_app LOGIN PASSWORD 'changeme_dev_only';

GRANT USAGE ON SCHEMA public TO nest_app;

ALTER DEFAULT PRIVILEGES FOR ROLE nest_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nest_app;

ALTER DEFAULT PRIVILEGES FOR ROLE nest_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nest_app;

-- No DDL rights of any kind for the runtime role.
REVOKE CREATE ON SCHEMA public FROM nest_app;

-- NOTE: this script cannot yet REVOKE UPDATE, DELETE ON audit_log /
-- inventory_transactions FROM nest_app — those tables don't exist until
-- `prisma migrate dev` runs, which happens after this init script.
-- That lockdown step lives in scripts/db-lockdown-audit-grants.sql,
-- run once after the first migration (see README "Setup" step 5).
