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

## Local secure credential setup and one-time staging restore

Two helper scripts are on this **isolated development branch**, not production.

1. On the authorized development server, open an interactive terminal in the branch worktree.
2. Open Aiven Console > `pg-377bd8ee` > Connection information and copy the PostgreSQL service URI. **Do not paste it in chat**.
3. Run `python3 scripts/configure-aiven-staging.py`. Paste the URI only at its hidden terminal prompt. The script validates the exact Aiven host/port and writes restrictive (0600) local PostgreSQL service and pass files under `~/.config/tahin-spare/`. It explicitly targets `tahinspare_staging` even if the Aiven URI defaults to `defaultdb`.
4. From the server, execute `bash scripts/aiven-restore-staging.sh /path/to/fresh-verified-backup.dump`. The restore aborts unless the destination is exactly the empty staging DB. No production secrets or app settings are changed.
5. Run independent database row-count, sequence, index, application read/write and parallel request checks before changing any Worker bindings. **Take another fresh Neon backup before production cutover**, as the original snapshot is already stale (the live database received at least one further inbound email).

The restore helper was rehearsed successfully against an isolated PostgreSQL 18.6 container using the actual 15-table archive. A second invocation correctly refused to overwrite 15 populated tables.

## Safe staging restore checklist
1. Obtain Aiven PostgreSQL connection details using Aiven Console's secure connection interface; keep credentials off the command line and out of git.
2. Ensure the destination is `tahinspare_staging`, not `defaultdb`; it must have zero user tables before restore.
3. Use PostgreSQL **18** client `pg_restore` with `--no-owner --no-acl --single-transaction --exit-on-error`, and the latest verified custom-format dump.
4. Check public table count, row counts, sequences, indexes, constraints, schema metadata and app queries; confirm application images still resolve from R2.
5. Test the prepared `pg-adapter.ts` with Cloudflare Hyperdrive's `AIVEN_HYPERDRIVE` binding in a non-production Worker. Use explicit `DB_PROVIDER=aiven`. Configure a small pool, mindful of Aiven Free's 20-connection cap. Keep Hyperdrive query caching disabled until write correctness is proven.
6. Freeze new writes for the final cutover, create and restore a fresh dump, verify counts and operation parity, then change the production Worker backend. Roll back to Neon if any gate fails; never delete Neon until verified backups and stable operation.

## Cloudflare Hyperdrive staging configuration

After staging import, create a **separate preview-only** Hyperdrive connection in Cloudflare Dashboard for the `tahinspare_staging` database. Enter origin credentials in Cloudflare's secret UI; never add them to Wrangler, GitHub or the chat. Disable Hyperdrive's SQL query cache during correctness certification (its cache does not automatically invalidate after writes). Set the origin connection limit to the minimum **5** initially, leaving connection headroom below Aiven Free's **20**-connection limit. Hyperdrive's limit is soft, so monitor actual Aiven connection counts under load.

Bind the resulting Hyperdrive ID to `AIVEN_HYPERDRIVE` on an isolated preview Worker. Set preview-only `DB_PROVIDER=aiven` and run the full product/category/admin/email regression suite. Do not configure this binding or provider flag on the live Worker before data parity and certification. Cloudflare's node-postgres integration requires `nodejs_compat` and at least `pg@8.16.3`; this branch uses `pg@8.23.1`.

Reference: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/ and https://developers.cloudflare.com/hyperdrive/configuration/tune-connection-pool/.

## Adapter
The feature branch adds a PostgreSQL driver compatible with the existing SQL tag, raw queries and atomic transaction API. Existing production defaults to Neon. Selecting Aiven without its Hyperdrive binding fails closed rather than silently reading the wrong database. The feature branch is **not** deployed.

## Production cutover gate
**NO-GO** until actual Aiven staging data restore, real Hyperdrive connection, app smoke tests, concurrent writes, private email workflows and final data parity all pass.
