# Dependency overrides

Every entry in `overrides` in `package.json` is a deliberate override of what a dependency asked for. Each one
belongs here, with why it exists and what would let it be removed — an override with no note is indistinguishable
from a mistake six months later.

## `deepmerge-ts: ^8.0.1`

**Why:** [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) — stack exhaustion when merging
recursive object graphs. High severity, and it affects everything below `8.0.0`.

**Why npm cannot fix it on its own:** the path into this project is

```
@prisma/client  ->  prisma  ->  @prisma/config  ->  deepmerge-ts
```

and `@prisma/config` depends on an *exact* version, `7.1.5`, not a range. There is nothing for npm to resolve.
`npm audit fix` reports a fix is available and then changes nothing.

**Why upgrading Prisma does not fix it:** the advisory's vulnerable range covers the entire published Prisma line.
`@prisma/config@7.9.1` — the newest release at the time of writing — still pins `deepmerge-ts: 7.1.5`, exactly as
6.19.3 does. A Prisma 6 → 7 major upgrade would be a real migration for no change in this advisory.

**Why `--omit=dev` does not sidestep it:** `@prisma/client` is a production dependency and pulls `prisma` in with
it, so this is in the production tree, not just in build tooling.

**Real-world exposure, honestly:** low. `deepmerge-ts` is used by `@prisma/config` to merge Prisma configuration,
which here is a developer-authored local file, not attacker-controlled input. The override is about not shipping
known-vulnerable code and keeping `npm audit --audit-level=high` meaningful — not about a live exploit path.

**Risk taken:** forcing a major (`7.1.5` → `8.0.1`) into a dependency that pinned it exactly. Verified afterwards:

- `npx prisma validate` — schema valid (this is the command that exercises the config loader)
- `npm run prisma:generate` — client generated
- `npm run build` — clean
- `npm run test:migrate` + the full integration suite in CI — green against real Postgres and Redis

**Remove it when:** `@prisma/config` ships a release depending on `deepmerge-ts` 8.x itself. Delete the entry, run
`npm install`, and let `.github/workflows/security.yml` tell you whether it was premature.
