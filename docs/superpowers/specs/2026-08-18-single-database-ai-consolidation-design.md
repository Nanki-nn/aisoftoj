# AI Single-Database Consolidation Design

## Goal

Move the Python AI runtime tables from the separate `aisoftoj_ai` MySQL
database into the existing `aisoftoj` database. After migration, Java and
Python use one database while Flyway and Alembic continue to own separate,
non-overlapping table sets.

## Decisions

- Preserve all existing AI threads, messages, runs, events, and summaries.
- Do not create or retain a backup of `aisoftoj_ai`.
- Drop `aisoftoj_ai` only after destination data, permissions, Alembic state,
  service readiness, and source emptiness are verified.
- Keep the `aisoftoj_ai` MySQL account, but grant it access only to
  `aisoftoj.*` so the AI service does not use the root account.
- Configure `/Users/bytedance/aisoftoj/aisoftoj-ai/config.yaml` to target
  `aisoftoj`.

## Migration

Stop the AI service before changing schema ownership. Confirm that
`ai_threads`, `ai_messages`, `ai_runs`, `ai_run_events`,
`ai_thread_summaries`, and `alembic_version` do not already exist in
`aisoftoj`. Inventory all source tables, views, triggers, routines, and events
through `information_schema`; abort unless the source contains exactly the six
expected tables and no additional schema objects.

Use one MySQL `RENAME TABLE` statement to move all six tables from
`aisoftoj_ai` to `aisoftoj`. Moving the related tables together avoids an
application-visible partial state and preserves their data, indexes, and
foreign-key relationships. Verify row counts and foreign-key definitions in
the destination before changing permissions.

Switch the `aisoftoj_ai@localhost` grant from `aisoftoj_ai.*` to
`aisoftoj.*`. Update the ignored local `config.yaml`, the tracked example,
README instructions, configuration validation, and configuration tests so
production targets `aisoftoj`; test databases may use names beginning with
`aisoftoj_test`. Run Alembic and service readiness checks against the moved
schema, then verify that the source database has no remaining objects before
dropping `aisoftoj_ai`.

Historical design and implementation documents remain unchanged because they
describe the decisions in effect when the AI runtime was originally built.

## Failure Handling

The AI service remains stopped if the source inventory, table move, row-count
verification, foreign-key verification, permission change, or Alembic check
fails. Because the user explicitly declined a backup, recovery before the old
database is dropped consists of renaming the tables back. The old database is
dropped only after destination data, permissions, Alembic state, and service
readiness all pass and the source is confirmed empty.

## Verification

1. Destination row counts match the pre-migration counts for every AI table.
2. `aisoftoj` contains the five AI runtime tables and `alembic_version`.
3. `aisoftoj_ai` no longer exists.
4. The restricted MySQL account can access `aisoftoj` and cannot access an
   unrelated database.
5. `alembic upgrade head` is a no-op against `aisoftoj`.
6. Python configuration and service tests pass.
7. The AI service starts from repository `config.yaml`, and `/livez` and
   `/readyz` return HTTP 200 while the Java service remains healthy.
