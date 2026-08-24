-- Repairs a database where nest_app already exists but is missing
-- grants — the situation this fixes: the Postgres data volume predates
-- infra/docker/init/01-create-app-role.sql being added, so that script
-- never ran (Postgres only executes docker-entrypoint-initdb.d scripts
-- against a genuinely empty volume).
--
-- Safe to re-run. Run as nest_migrator (owns the schema/tables):
--   psql "postgresql://nest_migrator:changeme_dev_only@localhost:5432/nest" -f scripts\db-repair-app-grants.sql
--
-- After this, re-run scripts/db-lockdown-audit-grants.sql — the blanket
-- grant below intentionally includes UPDATE/DELETE on audit_log (it has
-- to, to cover every other table in one statement), and the lockdown
-- script is what removes those two specifically per Database Design §7.

-- Create the role only if it's genuinely missing (rare — the error you
-- hit means it exists but lacks grants, but this makes the script safe
-- to run either way).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nest_app') THEN
    CREATE ROLE nest_app LOGIN PASSWORD 'changeme_dev_only';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO nest_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nest_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nest_app;

-- Covers tables created by FUTURE migrations too, same as the original
-- init script — this repair should only need to run once even if more
-- migrations land later.
ALTER DEFAULT PRIVILEGES FOR ROLE nest_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nest_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nest_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nest_app;

REVOKE CREATE ON SCHEMA public FROM nest_app;
