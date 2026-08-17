# Flyway MySQL Local Migration Design

## Goal

Restore compatibility between the local `aisoftoj` database and the current
backend schema while making the existing Flyway configuration capable of
running against MySQL 8 in both local and production environments.

## Context

The backend includes Flyway migrations V4 through V9 and currently declares
`flyway-core`, but startup with Flyway enabled fails with `Unsupported Database:
MySQL 8.0`. The local database has no `flyway_schema_history` table and has not
applied V5 through V9. This leaves runtime queries referencing columns that do
not exist, including `last_session_id` and `merged_into_session_id`.

Preflight checks also found legacy mock-only conflicts. A complete database
clone was created as `aisoftoj_backup_20260817_230702`. The 89 orphan answer
records were empty, unsubmitted mock records that referenced deleted questions,
and one of two duplicate active mock sessions was empty. Those records were
removed and the duplicate session was soft-deleted before migration.

## Design

Add the `org.flywaydb:flyway-mysql` runtime dependency beside `flyway-core` in
the backend Maven module. Leave the version managed by Spring Boot so both
modules resolve to the same compatible Flyway release.

Before touching a working database, resolve the Maven dependency tree and
confirm that `flyway-core` and `flyway-mysql` are both version 8.5.13. Run the
backend test suite after the dependency change and before any migration.

For the existing local database, enable Flyway for a one-time migration run
with `baseline-on-migrate=true` and `baseline-version=4`. Flyway will create its
history table, record V4 as the baseline, and execute V5, V6, V7, V8, and V9 in
order. The application will use a temporary random HTTP port during this run.

Baselining is permitted only after a schema fingerprint confirms that the
existing tables contain the required pre-V5 schema. The fingerprint is a
read-only `information_schema` check that must:

- confirm every base table in `db_schema.sql` exists;
- confirm `user.last_login_time` exists;
- confirm the required V5 inputs and types exist, including the bigint session
  identifiers, session status/mode/delete columns, answer-record identifiers
  and timestamps, paper-question score, question type, and wrong-question
  ownership and delete columns;
- confirm every V5-V9 target column and index is absent, so a partial migration
  cannot be mislabeled as V4; and
- rerun the V5, V7, and V8 data preflight queries and require zero conflicts.

The check exits nonzero and prevents Flyway startup when any assertion fails.
Its results must match on the working database and the post-cleanup backup.
Production must default `baseline-on-migrate` to false. A production database
without Flyway history requires a separate audited baseline procedure and an
explicit one-time override; normal deployment must never silently baseline it.

Keep the Java backend stopped after legacy cleanup so the database remains
quiescent. Create an immutable full post-cleanup backup, then create a separate
disposable rehearsal database from that backup. Run the complete V4 baseline
and V5-V9 migration against only the rehearsal database first. Keep the
post-cleanup backup untouched. Only migrate the still-quiescent working
database after the rehearsal passes every schema and data assertion.

V8 currently defines `last_session_id` as `int unsigned`, while
`practice_session.id` is `bigint unsigned`. Change the V8 migration and the
canonical `db_schema.sql` definition to `bigint unsigned` so the foreign
identifier cannot truncate. The Java model remains unchanged in this scoped
repair because the application's session ID contract is currently `Integer`;
expanding the application-wide ID contract is separate work.

No migration SQL will be bypassed or manually marked successful. Production
gains the missing MySQL database support through the Maven dependency while
changing its default baseline behavior to fail closed.

## Safety And Recovery

- Keep `aisoftoj_backup_20260817_230702` until all affected endpoints pass.
- Create and verify an immutable post-cleanup backup; this is the
  migration-ready recovery point.
- Create a separate disposable rehearsal clone from the post-cleanup backup.
- Require all V5, V7, and V8 preflight checks to pass before migration.
- Keep the normal Java backend stopped from backup creation through working
  database migration so the three databases cannot diverge through writes.
- Rehearse all non-transactional DDL against the disposable rehearsal clone first.
- Treat any failed migration as a stop condition; do not edit Flyway history.
- Restore the untouched post-cleanup backup if migration leaves the schema unusable.
- Retain the pre-cleanup backup as the forensic copy of the original state.

## Verification

1. Confirm the dependency tree resolves matching 8.5.13 Flyway modules and the backend tests pass.
2. Confirm Flyway history contains a successful V4 baseline and successful V5-V9 entries.
3. Confirm all V5-V9 columns, types, generated columns, and indexes exist.
4. Validate V7 snapshot backfills and V8 `last_session_id` backfills are complete.
5. Verify duplicate active sessions, duplicate session questions, and duplicate active wrong questions are rejected by their new unique keys.
6. Start the migrated application a second time and confirm Flyway performs a clean no-op.
7. Restart the normal Java backend on port 8080.
8. Verify authenticated `/paper/list`, `/session/history`, and `/wrong-questions` responses.
9. Exercise a representative start, answer update, submit, and wrong-question workflow.
