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
3. The root wrangler.jsonc now includes the isolated `supabase-preview` environment (`tahin-spare-suppliers-supabase-preview`) with DB_PROVIDER=supabase and separate automatically provisioned SESSION KV and MEDIA_BUCKET R2 bindings. No production route, public workers.dev URL or public preview URL is configured. Set SUPABASE_DATABASE_URL only on this preview Worker, not the root Worker. The target contains private copied records, so use a protected test route or controlled local preview; never enable public access before isolation and authentication are verified. Use a local `CLOUDFLARE_ENV=supabase-preview npm run build` and `npx wrangler deploy --env supabase-preview --dry-run` to validate config. Actual deployment and resource provisioning are separate from this configuration change.
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

No Cloudflare production routes, database provider flags, secrets, or deployments were modified by this migration stage.
