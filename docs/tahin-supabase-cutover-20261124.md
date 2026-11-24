# Tahin Supabase Direct-Pooler Migration Gate

Date: 2026-11-24. Organization: Primary (nfluOrg). Project: tahin-postgres (xpfowzrwjbojbgtekoim); Singapore; PostgreSQL 17.

## Verified

- The Supabase project is ACTIVE_HEALTHY with all 15 application tables. Previously reported row-count and full-row checksums match for the copied snapshot; ongoing parity still requires a fresh comparison.
- Local schema fingerprint fnv1a-775744fb matches Supabase app_schema_meta, so no schema upgrade is needed for the current source.
- All 15 public application tables have RLS enabled. The role tahin_worker can log in, does not bypass RLS, and has tested product/email read-write and schema read permissions. Anonymous email read access is denied. The security advisor returned no warnings.
- Existing Neon-compatible pg adapter is reused without changing production configuration or database schema.
- Direct shared Supavisor connection is implemented as an opt-in provider. Transaction pooler 6543 is preferred; session pooler 5432 is fallback. It enforces project and backend-role validation, verified TLS, no named prepared statements, short-lived connections and atomic transactions.
- Hyperdrive is optional for this provider, not mandatory. Production still defaults to Neon.

## Pending safe activation

1. An authorized administrator must privately obtain or configure the tahin_worker login credential and copy the exact shared pooler URI from the Supabase project's Connect panel. Do not share the credential in chat, shell history, source control or public client code. Avoid rotating a credential that is currently used elsewhere without a coordinated update.
2. Securely inject the URI as SUPABASE_DATABASE_URL into the authorized local process. Run npm run smoke:supabase. This is a read-only probe, checking the actual login role, schema fingerprint, 15 tables and aggregate product/email counts. Do not claim it passed until the real endpoint has been used.
3. The root wrangler.jsonc now uses the native Cloudflare `previews` block instead of a separately named Wrangler environment. `npm run build` and `npx wrangler preview --name supabase-migration --worker-name tahin-spare-suppliers --ignore-base-config` create the same-Worker Preview with DB_PROVIDER=supabase and the previously provisioned isolated SESSION and MEDIA_BUCKET bindings. Its dynamic routes are locked by TAHIN_PREVIEW_LOCKED=true (verified HTTP 503, no-store). Native Preview secrets do not inherit production secrets. Set SUPABASE_DATABASE_URL on the individual Preview via the Dashboard or `npx wrangler preview secret put SUPABASE_DATABASE_URL --name supabase-migration --worker-name tahin-spare-suppliers` in an interactive trusted terminal. Configure and verify Cloudflare Access for Previews only, restricted to authorized operators, before removing the application lock. Do not expose copied private records through public previews. Production remains on Neon.
4. Perform Worker runtime QA: product/category/brand reads, CMS edits, login, public enquiries, inbound/outbound private mail, follow-ups, atomic rollback, concurrent queries and latency, without sending genuine production emails or webhook side effects.
5. Re-verify all table data and sequences against the live Neon source. Before final cutover, ensure a fresh verified backup, freeze/drain live writes and email webhook delivery, copy final delta, verify exact parity, and have a tested rollback procedure that preserves any post-cutover writes.
6. Only after these gates pass should production DB_PROVIDER be changed in a separately reviewed reversible release. Do not remove Neon before a stable operation window and verified restore path.

## No-go conditions

Any connection/authentication failure, TLS error, schema mismatch, stale mail rows, missing write privileges, transaction incompatibility, failed production-like preview workflow or unacceptable latency means production remains on Neon.

Cloudflare supports PostgreSQL TCP connections without Hyperdrive, but recommends Hyperdrive for repeated external SQL requests because per-request setup can add latency. Supabase Free projects may pause with inactivity; website visits alone do not guarantee database activity.

## Local tests

- node --experimental-strip-types --test tests/supabase-provider.test.ts
- npm test
- npm run build
- npm run smoke:supabase (requires a real secret and network access)

## Preview deployment evidence — 2026-11-24

- Private preview Worker deployed: tahin-spare-suppliers-supabase-preview. Version a882cc9c-e367-4c15-8299-e11f710272b9. Wrangler reported no public targets deployed.
- Isolated KV SESSION and R2 MEDIA_BUCKET were provisioned successfully and are now explicitly pinned in wrangler.jsonc for subsequent deployments.
- Cloudflare lists SUPABASE_DATABASE_URL on the production Worker, but the preview Worker has zero secrets. Cloudflare does not return secret values. Authorized operator must set the same valid restricted-role connection URI on the preview Worker separately. Do not copy or expose secret values through code or logs.
- Remote PostgreSQL connection, protected runtime access, functional QA, and latest Neon data parity remain pending. Preview deployment is not production readiness.

## Same-Worker Native Preview evidence — 2026-11-24

- Worker: tahin-spare-suppliers. Native Preview: supabase-migration. Preview deployment ID: 39d9f7a0-957f-4c07-98ee-2806b1ddc025.
- Preview URL: https://supabase-migration-tahin-spare-suppliers.rahmatullahzisan.workers.dev/
- Preview deployment reports DB_PROVIDER=supabase, TAHIN_PREVIEW_LOCKED=true and the isolated KV/R2 bindings. Public root request returned HTTP 503 with no-store and noindex; lock is working. Preview secrets list is empty. Do not unlock until Preview-only Access and secure credentials are configured.
- Production deployment remained ae5c4429-d5ea-4d47-852a-7266258e7403 (100% traffic) before and after Native Preview creation. No production traffic was moved.
- Native Preview supersedes the separate Worker configuration. The old private standalone Worker is retained temporarily pending final QA; do not delete its KV/R2 resources because the Native Preview now uses them.
- Tests: 221 pass, 2 skip, 0 fail; Astro build passed. Actual database login and functional QA remain pending.

## Read-only native Preview — 2026-11-24

- Preview deployment bc26a7a4-764e-423e-bed2-17c94ade19fd replaces the blanket lock with TAHIN_PREVIEW_READ_ONLY=true. Public catalogue page reads are allowed after Access authentication; admin, APIs, forms and mutations remain denied. Responses are no-store and noindex.
- Preview now has SUPABASE_DATABASE_URL bound. Cloudflare Access login redirects were verified on the root, migration-health and private routes. An authenticated operator must visit /migration-health to exercise the real Worker PostgreSQL login, schema and catalogue probe; an anonymous redirect does not prove database connectivity. The probe returns only pass/fail, no data or credentials.
- Tests 221 pass, 2 skip, 0 fail; build passes. Production cutover remains blocked by runtime verification and latest data parity.

No Cloudflare production routes, database provider flags, secrets, or deployments were modified by this migration stage.
