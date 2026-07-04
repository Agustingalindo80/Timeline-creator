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
