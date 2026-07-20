---
name: db:push interactive drift prompt
description: Why `npm run db:push` can hang on an unrelated prompt and how to safely add nullable columns instead.
---

# `drizzle-kit push` hangs on unrelated schema drift

Running `npm run db:push` in this repo can stop on an interactive prompt about a
pre-existing constraint (e.g. `tenants_slug_unique`) that asks whether to
truncate a populated table. Piping newlines into the process does NOT satisfy the
prompt — drizzle-kit reads from a TTY, so `printf '\n' | npm run db:push` still blocks.

**Why:** the DB has drift from the current schema unrelated to your change, and
drizzle-kit surfaces every diff (including destructive ones) as a blocking TTY prompt.

**How to apply:** when your change only ADDS nullable columns, skip `db:push` and
apply them directly and idempotently:
`psql "$DATABASE_URL" -c "ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <col> <type>;"`
This avoids the truncation prompt entirely and never risks data loss. Reserve
`db:push` for when the drift itself needs resolving (and answer the prompt in a
real interactive terminal).

**Resolved (July 2026):** the recurring `tenants_slug_unique` prompt was a
constraint NAME mismatch — the DB had `tenants_slug_key`, drizzle expected
`tenants_slug_unique`. Fixed with `ALTER TABLE tenants RENAME CONSTRAINT`.
If a similar prompt recurs, check for name-mismatched constraints before
assuming real drift. `scripts/post-merge.sh` now runs
`npm run db:push -- --force` (non-interactive) with a 120s timeout.

For whole new tables, apply them via direct `CREATE TABLE IF NOT EXISTS` SQL
that mirrors the Drizzle definition **exactly** (same column types and the same
constraint/index names drizzle would generate) so a later `db:push` sees them as
in-sync and does not try to recreate them.

**Views are not managed by `drizzle-kit push` at all.** Create/replace them with
`CREATE OR REPLACE VIEW` yourself, and persist that SQL in a repeatable setup
step (post-merge/provisioning) or it will be missing on a freshly provisioned DB.
