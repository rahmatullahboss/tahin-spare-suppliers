# Blog Rich Text Editor — Design Spec

**Date:** 2026-05-17
**Goal:** Replace the plain textarea in the blog editor with a Tiptap rich text editor, and render HTML content on the public blog detail page.

## Current State

- **Tiptap installed** (`@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/pm`, `@tiptap/react`) but not used in blog editor
- **`TiptapEditor.astro`** exists with basic toolbar (bold, italic, H2, lists, undo/redo) — not integrated
- **Blog admin** (`ContentEditor.astro`) uses `<textarea>` for content field
- **Blog detail** (`[slug].astro`) renders content via `post.content.split("\n")` → `<p>` tags
- **Database:** `blog_posts.content` is TEXT type — can store HTML without schema change

## Scope

Replace textarea with Tiptap editor for blog posts only. No changes to products or parts editors.

## Changes Required

### 1. Upgrade `src/components/TiptapEditor.astro`

**Extended toolbar features:**
- Formatting: Bold, Italic, Strikethrough, Inline Code
- Headings: H2, H3
- Lists: Bullet List, Ordered List
- Blocks: Blockquote, Code Block, Horizontal Rule
- Insert: Link (URL prompt), Image (URL prompt)
- History: Undo, Redo

**HTML output sync:**
- Maintain a hidden `<input>` that syncs with `editor.getHTML()` on every transaction
- Expose `data-tiptap-output` attribute on the hidden input for form collection
- On editor init, load initial content from the hidden input value (for edit mode)

**Tiptap extensions to add:**
- `@tiptap/extension-link` — for link insertion
- `@tiptap/extension-image` — for image embedding
- `@tiptap/extension-placeholder` — for placeholder text
- `@tiptap/extension-code-block` — for code blocks
- `@tiptap/extension-strike` — for strikethrough (already in StarterKit)

### 2. Modify `src/components/admin/ContentEditor.astro`

For `type === "blog"` only:
- Replace `<textarea name="content" data-content>` with `<TiptapEditor>` component
- On form submit: read HTML from the Tiptap hidden input instead of textarea value
- On `fillForm()` (edit mode): set the hidden input value before Tiptap init, or call a method to set editor content
- Keep textarea for products/parts (unchanged)

### 3. Modify `src/pages/blog/[slug].astro`

- Replace `post.content.split("\n").filter(Boolean).map((line) => <p>{line}</p>)` with `<div class="content" set:html={post.content}></div>`
- Add CSS styles for rich text elements: headings, blockquotes, code blocks, links, images, lists, horizontal rules

### 4. Security — HTML Sanitization

- Tiptap generates safe HTML by default (no `<script>`, `<iframe>`, etc.)
- The `set:html` directive does NOT auto-escape — this is by design for trusted content
- Since only admin-authenticated users can create blog posts, the risk is acceptable
- Content is stored in D1 and served server-side — no client-side injection vector

## Files to Modify

1. `src/components/TiptapEditor.astro` — upgrade toolbar, add extensions, HTML sync
2. `src/components/admin/ContentEditor.astro` — swap textarea for TiptapEditor for blog type
3. `src/pages/blog/[slug].astro` — render HTML with set:html, add rich text CSS

## No Changes Required

- Database schema (TEXT column already supports HTML)
- API endpoints (already handle string content)
- Repository layer (no type changes needed)
- Blog listing page (only shows title + excerpt)

## Dependencies

Need to install:
- `@tiptap/extension-image` — for image embedding (NOT in StarterKit)
- `@tiptap/extension-placeholder` — for placeholder text (NOT in StarterKit)

Already included in StarterKit: blockquote, bold, bullet-list, code, code-block, heading, horizontal-rule, italic, link, ordered-list, strike, underline.
