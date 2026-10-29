# Tahin Spare — anonymous catalogue cache (2026-10-29)

## Purpose
Neon Free hits its 100 CU-hour allowance when each visitor makes database reads. Catalogue products and public marketing pages change infrequently, so cache their rendered HTML at the Cloudflare edge.

## Implementation
- Cloudflare Worker Cache API, 12-hour TTL, **only** anonymous GET for allowlisted public HTML.
- KV revision key `tahin:catalogue-cache-version:v1` stored in existing Cloudflare `SESSION` namespace. Cache keys incorporate the revision, so successful CMS writes make the previous version unreachable once the new revision propagates.
- Cache is **bypassed** for authenticated admin sessions, Authorization, query strings, no-cache refresh, non-GET requests, and routes containing private/admin/enquiry API content.
- Responses with Set-Cookie, private/no-store, non-HTML, errors or redirects never enter the cache.
- Browser cache is disabled; the 12-hour TTL is only for the Worker edge cache. Header `X-Tahin-Catalogue-Cache: HIT|MISS` aids verification.
- If KV or Cache API is unavailable, requests fall back to normal rendering.
- KV is eventually consistent across regions: after CMS editing, some remote regions may still see old content briefly (typically up to ~60 seconds). Out-of-band direct database edits do **not** invalidate automatically; expiry is the 12-hour cap.
- Cloudflare Cache API is local per data center, not tiered. Each edge region warms its own entry. Cache eviction is possible.

## Restore and operational safety
Do not cache `/admin`, `/api`, `/contact`, `/enquiry`, signed-in HTML, or any private email or user-specific payload. Preserve the previous Neon/R2 backup strategy; cache is not a backup.

## Verification before deployment
1. Run `npm test`, `npm run build`.
2. Confirm no other dirty worktrees are replaced. Deploy only from an reviewed integrated branch.
3. Two ordinary GETs to `/products` and `/category/spare-parts` should show `MISS` followed by `HIT`; admin-cookie request should not show HIT.
4. Edit a test product via admin CMS; public page should show new data after KV propagation and a MISS, without allowing private content in shared cache.
5. Check Neon compute activity and network egress, especially after 24 hours; compare to a pre-change baseline.
