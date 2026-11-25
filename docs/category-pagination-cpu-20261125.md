# Category pagination CPU candidate — 2026-11-25

Production baseline pinned by Wrangler Tail event version 5a2ed29d-0835-4ebf-9064-847027027c39:
- Uncached homepage CPU 7,9,8,7 ms.
- Uncached spare-parts CPU 11,10,11,11 ms; response 123688 bytes each.
- Uncached products CPU 5,5,4 ms; one of four tail events absent. All 12 HTTP requests returned 200. Strict full-sample gate failed due to missing event, not mixed versions.

Candidate:
- Top-level categories render at most 12 full product cards per URL, rather than all selected cards (old upper limit 1000); existing selection and complete brand/model link directory unchanged. Page links are crawlable with self-canonical pages, invalid pages return 404. Pagination clicks navigate to the product grid; initial load does not autoscroll. Subcategory pages are unchanged.
- Page cache admits only bounded single category page parameters, preserves tracking normalization, rejects unknown query params and authenticated requests as before. Category cache key format bumped to avoid stale pre-pagination HTML.
- Benchmark prints actual Worker version per event and fails on mixed/unexpected versions.
- 228 tests PASS, 2 skipped; Astro build PASS; actual local PostgreSQL18/workerd smoke PASS with 35 category products, 12/12/11 cards and all links retained, canonical page 2 and out-of-range 404. Local function profiling works.
- No production CPU reduction claimed before exact candidate-version benchmark; retained full metadata query and brand/model directory mean database work is not reduced by the pagination change alone.
