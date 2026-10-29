# Tahin Spare — Aiven PostgreSQL staging migration readiness

Date: 2026-10-29

## Existing infrastructure
- Cloudflare Worker runs Astro with the Neon HTTP driver in production.
- Neon source: project `tahin`, database `neondb`, PostgreSQL 17.
- Aiven destination: project `rahmatullahzisan-5bcc`, service `pg-377bd8ee`, PostgreSQL 18.6, Free 1 GB, `do-blr`.
- Isolated empty destination database: `tahinspare_staging`.
- Known-good dump: `/home/user/backups/tahin-spare/tahin-neondb-2026-10-29T01-15-18Z.dump`. It was restored in local PostgreSQL 18.6; records match 15 tables, 116 products, 52 brands, 201 inbound emails, 326 sent emails and 56 follow-up drafts. **This backup is a snapshot; take a fresh one before any final production cutover.**
- Original Cloudflare R2 private backup bucket `tahin-spare-db-backups` contains the verified dump.

## Current blockers
The Aiven connector redacts service connection credentials. Aiven SQL Editor has statement-size limitations and cannot reliably import multi-megabyte email rows from a custom PostgreSQL dump. A direct source-credential migration attempt was prevented by security checks. Do not bypass the security boundary or expose credentials in chat.

A person with Aiven Console access must establish a secure native PostgreSQL session on the authorized development server or create a Cloudflare Hyperdrive configuration. Do not put connection details in source control or conversation logs.

## Safe staging restore checklist
1. Obtain Aiven PostgreSQL connection details using Aiven Console's secure connection interface; keep credentials off the command line and out of git.
2. Ensure the destination is `tahinspare_staging`, not `defaultdb`; it must have zero user tables before restore.
3. Use PostgreSQL **18** client `pg_restore` with `--no-owner --no-acl --single-transaction --exit-on-error`, and the latest verified custom-format dump.
4. Check public table count, row counts, sequences, indexes, constraints, schema metadata and app queries; confirm application images still resolve from R2.
5. Test the prepared `pg-adapter.ts` with Cloudflare Hyperdrive's `AIVEN_HYPERDRIVE` binding in a non-production Worker. Use explicit `DB_PROVIDER=aiven`. Configure a small pool, mindful of Aiven Free's 20-connection cap. Keep Hyperdrive query caching disabled until write correctness is proven.
6. Freeze new writes for the final cutover, create and restore a fresh dump, verify counts and operation parity, then change the production Worker backend. Roll back to Neon if any gate fails; never delete Neon until verified backups and stable operation.

## Adapter
The feature branch adds a PostgreSQL driver compatible with the existing SQL tag, raw queries and atomic transaction API. Existing production defaults to Neon. Selecting Aiven without its Hyperdrive binding fails closed rather than silently reading the wrong database. The feature branch is **not** deployed.

## Production cutover gate
**NO-GO** until actual Aiven staging data restore, real Hyperdrive connection, app smoke tests, concurrent writes, private email workflows and final data parity all pass.
