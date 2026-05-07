# Admin Pages Pagination — Design Spec

## Context

Admin panel er 4ta non-email page (enquiries, contact-messages, products, blog) currently unlimited data fetch kore server-side. Email pages (emails.astro, emails/inbound/index.astro) already client-side pagination use kore with API-based approach. Ei spec goal holo email pages er pattern follow kore non-email pages gula paginated kora.

## Pages Affected

| Page | File | Current State |
|------|------|---------------|
| Enquiries | `admin/enquiries.astro` | Server-side render all rows, no limit |
| Contact Messages | `admin/contact-messages.astro` | Server-side render all rows, no limit |
| Products | `admin/products.astro` | ContentEditor, fetches all via `/api/products` |
| Blog | `admin/blog.astro` | ContentEditor, fetches all via `/api/blog` |

Email pages (already done):
- `admin/emails.astro` — client-side pagination via API
- `admin/emails/inbound/index.astro` — client-side pagination via API

## API Changes

### Enquiries API
Add pagination to `/api/enquiries`:
```
GET /api/enquiries?page=1&limit=20&search=term
Response: { items: [], total: number, totalPages: number, page: number }
```

### Contact Messages API
Add pagination to `/api/contact-messages`:
```
GET /api/contact-messages?page=1&limit=20&search=term
Response: { items: [], total: number, totalPages: number, page: number }
```

### Products & Blog APIs
Already support GET `/api/{type}`. Add pagination params:
```
GET /api/products?page=1&limit=20
GET /api/blog?page=1&limit=20
Response: { items: [], total: number, totalPages: number, page: number }
```

## Frontend Changes

### Enquiries & Contact Messages
- Convert server-rendered list to client-side rendered with JavaScript
- Fetch data from API on load and on search
- Render pagination controls (Prev, Next, page numbers)
- Same UI pattern as emails.astro

### ContentEditor.astro (Products & Blog)
- Add pagination controls below items list
- Pass `page` and `limit` params when fetching items
- Update `loadItems()` to handle pagination state
- Page size: 20 items per page

### Pagination Component Pattern (shared)
```javascript
// Client-side pagination state
let currentPage = 1;
const PAGE_SIZE = 20;
let totalPages = 1;

// Pagination HTML structure
<div class="pagination">
  <button id="prev-btn">Prev</button>
  <span class="page-numbers">1 2 3 ... n</span>
  <button id="next-btn">Next</button>
  <span class="page-info">Page 1 of 5</span>
</div>
```

## Shared Pagination Styles
Existing email pages er `.pagination` CSS class reuse korbe — already defined:
```css
.pagination { display: flex; justify-content: center; gap: 8px; }
.pagination button { padding: 8px 14px; border: 1px solid #ddd; ... }
.pagination .page-info { padding: 8px 12px; color: #666; }
```

## Implementation Order
1. API endpoints update (enquiries, contact-messages, products, blog)
2. ContentEditor.astro pagination
3. enquiries.astro client-side pagination
4. contact-messages.astro client-side pagination

## Search Behavior
Search inputs already have 300ms debounce. Keep:
- Filter changes reset to page 1
- Search query sent to API as `?search=term`