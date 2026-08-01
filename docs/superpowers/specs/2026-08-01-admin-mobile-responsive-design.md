# Admin Panel Mobile Responsiveness — Design Spec

Date: 2026-08-01
Status: Approved direction (Option 2 — Adaptive Admin System)
Surface: `/admin/**`
Mode: Operate

## Goal

Make the full admin panel production-grade on phones and small tablets without degrading the existing desktop experience. The mobile experience must prioritize scanability, touch comfort, fast editing, and reliable navigation while preserving all current admin capabilities.

## Scope

The responsive pass covers:

- `/admin` dashboard
- `/admin/products`
- `/admin/blog`
- `/admin/categories`
- `/admin/contact-messages`
- `/admin/enquiries`
- `/admin/emails`
- `/admin/emails/send`
- `/admin/emails/thread/[source]/[id]`
- Shared admin shell/sidebar, editor components, upload/editor controls, pagination, list rows, and form actions used by those routes

Login is out of scope unless a shared shell/style change affects it indirectly.

## Design Direction

Preserve the current light admin visual language, amber accent, typography, and information hierarchy. This is a responsive adaptation, not a visual rebrand.

Desktop keeps the existing left sidebar and multi-column layouts. At `<= 900px`, the shell becomes an app-like mobile administration surface with a sticky top bar and a slide-out navigation drawer.

## Navigation

### Desktop

- Existing fixed/sticky left navigation remains.
- Existing active-state styling remains recognizable.

### Mobile and Tablet

- Replace the horizontal-scroll navigation with a compact sticky top bar.
- Top bar contains:
  - Hamburger button
  - Current section label/title
  - Optional compact context/action slot when useful
- Hamburger opens a left drawer containing all admin destinations.
- Drawer requirements:
  - Full-height viewport treatment
  - Backdrop overlay
  - Explicit close button
  - Close on backdrop tap
  - Close on Escape
  - Close after navigation selection
  - Prevent background page scrolling while open
  - Preserve active section state
  - Include `View Site`
  - Logout remains available from the admin surface rather than disappearing on mobile
- Minimum interactive target: 44px.
- Visible keyboard focus must remain present.

## Layout System

### Breakpoints

- Desktop: `> 1100px`
- Tablet: `601px–1100px`
- Mobile: `<= 600px`
- Admin navigation switches to drawer at `<= 900px`

These align with the current codebase breakpoints to avoid unnecessary fragmentation.

### Mobile Content Frame

- 12–16px horizontal page gutter.
- No accidental document-level horizontal scrolling.
- Cards and panels use the available viewport width.
- Large desktop-only sticky elements become normal-flow elements on narrow screens.
- Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` where fixed/sticky controls meet device edges.

## Dashboard

- Header becomes vertically stacked on small screens.
- Quick action buttons become touch-friendly and fill available width when needed.
- Summary cards collapse to one column on phones.
- Two-column dashboard content becomes one column.
- Recent-item rows allow multi-line titles and protect the trailing action label.
- Inventory labels/counts remain readable with long category names.

## Products and Blog Editor

### Desktop

Keep current split layout: list + sticky form.

### Tablet/Mobile

- Collapse to a single column.
- Editing/creation form appears before the item list on narrow screens so the primary task is immediately available.
- Sticky form behavior is disabled.
- Search field becomes full width.

### Item List Transformation

Wide table presentation must not require horizontal scrolling on phones.

On mobile, each table row becomes a compact card-like record using responsive CSS while retaining the same semantic/data source:

- Thumbnail
- Title
- Excerpt preview when present
- Product category
- Brand
- Model
- Edit and Delete actions

The desktop table header is hidden on phones. Cell labels/metadata are reorganized visually inside each row.

Action buttons must be at least 44px high or provide an equivalent 44px hit area.

### Forms

- Inputs/selects/textarea use at least 16px font size on phones to avoid browser auto-zoom.
- Brand/Model two-column row becomes one column.
- Save/Reset actions stack or stretch appropriately.
- Status messages remain adjacent to the action area.
- Image preview never exceeds container width.

### Rich Text Editor

- Toolbar can wrap or horizontally contain itself without widening the page.
- Editor content area remains readable at phone width.
- Embedded images/content must respect `max-width: 100%`.

## Categories

- Add/Edit form becomes full-width on mobile.
- Category rows become two-stage cards:
  - image + identity block
  - actions below
- Category/subcategory names and slugs wrap safely.
- Subcategory indentation is reduced on phones so nested content does not lose usable width.
- Edit/Delete controls meet touch target requirements.
- Existing category hierarchy remains unchanged.

## Contact Messages

- Search field fills the toolbar width on phones.
- Sender block and timestamp stack cleanly.
- Email addresses can wrap/break without layout overflow.
- Subject and message preview use full available width instead of desktop left offsets.
- Message cards retain clear separation and tap affordance.
- Pagination adapts to narrow screens without overflowing.

## Enquiries

- Same responsive list model as Contact Messages.
- Sender/contact information wraps safely.
- Equipment badge wraps rather than overflowing.
- Timestamp moves below or beside sender based on available space.
- Message panel loses desktop left indentation on phones.
- Pagination remains usable at 320px width.

## Email Mailbox

Preserve the Gmail-inspired desktop surface already implemented.

### Mobile Header

- Mailbox title/summary and Compose action stack or share a compact mobile header.
- Compose remains prominent and easy to reach.

### Toolbar

- Inbox/Sent tabs stay visible.
- Search and Refresh move to a second row on narrow screens.
- Search becomes flexible/full-width.
- Inbox filters remain horizontally compact and must not cause page overflow.

### Message Rows

Desktop three-column mail rows become stacked mobile conversation rows:

1. Sender/person + timestamp
2. Subject
3. Snippet and metadata/attachment indicator

Unread emphasis remains obvious.

### Thread

- Subject/header controls adapt to one-column mobile hierarchy.
- Individual email message headers wrap safely.
- HTML email body is constrained to the viewport.
- Images and attachments never overflow the content area.
- Reply/forward actions remain touch-sized.

### Compose

- Recipient/subject/editor fields use full width.
- Toolbar is wrap-safe or horizontally contained.
- Attachment chips/list wrap.
- Send action remains prominent and reachable.
- Inline images respect viewport width.

## Shared Responsive Quality Rules

- No document-level horizontal scrolling at 320px, 375px, 390px, 430px, 768px widths.
- Minimum 44px interactive hit target for primary touch actions.
- Inputs use mobile-safe font sizing.
- Long emails, slugs, product names, and filenames cannot break layout.
- Hover-only affordances must have a non-hover equivalent.
- Focus-visible states remain visible.
- Motion remains subtle and respects `prefers-reduced-motion`.
- Existing desktop behavior must not regress.

## Accessibility

- Mobile menu button has an accessible name and `aria-expanded` state.
- Drawer has a clear navigation landmark.
- Backdrop is not the only way to close the drawer.
- Keyboard users can close the drawer with Escape.
- Focus order follows the visual order.
- Color is not the only state indicator for active/unread/destructive actions.

## Implementation Boundaries

- No framework change.
- No rebrand.
- No backend/data-model change expected.
- No removal of existing desktop actions.
- Prefer shared shell/component CSS changes over duplicating page-specific hacks.
- Page-specific responsive CSS is allowed where the underlying information architecture differs.

## Testing and Verification

### Automated

Add source-level regression tests for critical responsive contracts where practical, including:

- Mobile drawer controls exist in shared admin navigation.
- Legacy horizontal-scroll mobile navigation is removed.
- Product/blog table has a mobile non-horizontal presentation contract.
- Mobile-safe form font sizing and overflow protections exist.

Run:

- `npm test`
- `npm run build`
- `npm audit --omit=dev`

### UI Quality

Run the Impeccable detector once after UI edits over changed admin targets.

### Manual/Browser Acceptance

At minimum check representative pages at:

- 320 × 568
- 375 × 812
- 390 × 844
- 430 × 932
- 768 × 1024
- Desktop >= 1280px

Acceptance conditions:

- Navigation opens/closes correctly.
- No page-level horizontal overflow.
- Forms are usable without zooming/panning.
- Products/Blog records are readable without horizontal table scrolling.
- Email mailbox/thread/compose remain fully usable.
- Desktop layout remains intact.

## Success Criteria

The admin panel should feel intentionally designed for mobile rather than merely compressed from desktop: navigation is immediate, editing flows are comfortable, information remains scannable, destructive/primary actions are easy to hit, and no admin route requires horizontal page scrolling to complete normal work.
