#!/bin/sh
# The container's start command: migrate, sync the vaccine catalog, serve.
#
# `prisma migrate deploy` takes a session-level Postgres advisory lock
# (pg_advisory_lock) so two migrators never run at once. Production connects
# through Neon's PgBouncer pooler in transaction mode, where the lock and its
# release can land on different server connections; the release then misses,
# and the lock stays held on a pooled connection until the pooler retires it.
# Measured on 2026-10-12: the next boot (a deploy, or a wake from the free
# plan's sleep) timed out on the lock (P1002, 10 s) at 22:41:49, 22:42:29 and
# 22:43:00, and got it at 22:43:35. Render had already marked the deploy failed
# on the first exit.
#
# So the migration is retried, not skipped: the lock still guards against two
# migrators, and a boot waits out a stale lock instead of dying on it. Eight
# attempts 15 s apart cover about three and a half minutes, beyond the two
# measured. Configuring DIRECT_DATABASE_URL (a non-pooled connection, read by
# prisma.config.ts) removes the cause; this keeps boots alive without it.
set -eu

attempt=1
max_attempts=8
until npx prisma migrate deploy; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "prisma migrate deploy failed after $attempt attempts" >&2
    exit 1
  fi
  echo "prisma migrate deploy failed (attempt $attempt of $max_attempts); retrying in 15s" >&2
  attempt=$((attempt + 1))
  sleep 15
done

node dist-seed/prisma/seed.js
exec node dist/main.js
