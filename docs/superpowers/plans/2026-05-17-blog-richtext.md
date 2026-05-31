# Blog Rich Text Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blog editor's plain textarea with a Tiptap rich text editor and render HTML content on the public blog detail page.

**Architecture:** Inline Tiptap integration within the existing `ContentEditor.astro` component. The `TiptapEditor.astro` component is upgraded with extended toolbar and HTML sync via a hidden input. Blog detail page switches from newline-split rendering to `set:html` directive.

**Tech Stack:** Astro 6, Tiptap 3 (core, starter-kit, extension-image, extension-placeholder), Cloudflare D1

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/TiptapEditor.astro` | Modify | Extended toolbar, HTML sync via hidden input, Tiptap extensions |
| `src/components/admin/ContentEditor.astro` | Modify | Swap textarea for TiptapEditor when `type === "blog"` |
| `src/pages/blog/[slug].astro` | Modify | Render HTML content with `set:html`, add rich text CSS |

---

### Task 1: Install Tiptap Extensions

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @tiptap/extension-image and @tiptap/extension-placeholder**

```bash
npm install @tiptap/extension-image @tiptap/extension-placeholder
```

- [ ] **Step 2: Verify installation**

```bash
npm ls @tiptap/extension-image @tiptap/extension-placeholder
```

Expected: Both packages listed at `^3.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add tiptap image and placeholder extensions"
```

---

### Task 2: Upgrade TiptapEditor.astro

**Files:**
- Modify: `src/components/TiptapEditor.astro`

This is the core change. Replace the entire component with an upgraded version that:
- Has extended toolbar (H3, blockquote, code block, link, image, horizontal rule, strikethrough, inline code)
- Syncs editor HTML to a hidden input for form collection
- Loads initial content on mount (for edit mode)
- Supports placeholder text

- [ ] **Step 1: Replace TiptapEditor.astro content**

Replace the entire file with:

```astro
---
interface Props {
  id?: string;
  placeholder?: string;
  initialContent?: string;
}

const { id = "editor", placeholder = "Start writing your blog post...", initialContent = "" } = Astro.props;
---

<div class="tiptap-wrapper" data-tiptap-wrapper data-editor-id={id}>
  <div class="tiptap-toolbar">
    <div class="toolbar-group">
      <button type="button" data-command="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>
      <button type="button" data-command="italic" title="Italic (Ctrl+I)"><em>I</em></button>
      <button type="button" data-command="strike" title="Strikethrough"><s>S</s></button>
      <button type="button" data-command="code" title="Inline Code"><code>&lt;/&gt;</code></button>
    </div>
    <span class="toolbar-separator"></span>
    <div class="toolbar-group">
      <button type="button" data-command="h2" title="Heading 2">H2</button>
      <button type="button" data-command="h3" title="Heading 3">H3</button>
    </div>
    <span class="toolbar-separator"></span>
    <div class="toolbar-group">
      <button type="button" data-command="bulletList" title="Bullet List">&bull; List</button>
      <button type="button" data-command="orderedList" title="Numbered List">1. List</button>
    </div>
    <span class="toolbar-separator"></span>
    <div class="toolbar-group">
      <button type="button" data-command="blockquote" title="Blockquote">"</button>
      <button type="button" data-command="codeBlock" title="Code Block">{ }</button>
      <button type="button" data-command="horizontalRule" title="Horizontal Rule">—</button>
    </div>
    <span class="toolbar-separator"></span>
    <div class="toolbar-group">
      <button type="button" data-command="link" title="Insert Link">🔗</button>
      <button type="button" data-command="image" title="Insert Image">🖼</button>
    </div>
    <span class="toolbar-separator"></span>
    <div class="toolbar-group">
      <button type="button" data-command="undo" title="Undo (Ctrl+Z)">&#8630;</button>
      <button type="button" data-command="redo" title="Redo (Ctrl+Y)">&#8631;</button>
    </div>
  </div>
  <div class="tiptap-content" data-editor-content></div>
  <input type="hidden" name="content" data-tiptap-output value={initialContent} />
</div>

<style>
  .tiptap-wrapper {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    overflow: hidden;
    background: #fff;
  }

  .tiptap-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 8px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    align-items: center;
  }

  .toolbar-group {
    display: flex;
    gap: 2px;
  }

  .tiptap-toolbar button {
    padding: 5px 8px;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    min-width: 30px;
    transition: all 0.15s;
    color: #475569;
    line-height: 1;
  }

  .tiptap-toolbar button:hover {
    background: #e2e8f0;
    border-color: #cbd5e1;
  }

  .tiptap-toolbar button.active {
    background: #d97706;
    color: #fff;
    border-color: #d97706;
  }

  .tiptap-toolbar button code {
    font-size: 11px;
    font-family: monospace;
  }

  .toolbar-separator {
    width: 1px;
    height: 24px;
    background: #e2e8f0;
    margin: 0 4px;
    align-self: center;
  }

  .tiptap-content {
    padding: 16px;
    min-height: 250px;
    max-height: 500px;
    overflow-y: auto;
    outline: none;
    font-size: 15px;
    line-height: 1.7;
    color: #334155;
  }

  .tiptap-content:focus {
    box-shadow: inset 0 0 0 2px rgba(217, 119, 6, 0.15);
  }

  .tiptap-content p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: #94a3b8;
    pointer-events: none;
    float: left;
    height: 0;
  }

  .tiptap-content h2 {
    font-size: 1.4rem;
    margin: 1.2em 0 0.5em;
    font-weight: 700;
    color: #0f172a;
  }

  .tiptap-content h3 {
    font-size: 1.15rem;
    margin: 1em 0 0.4em;
    font-weight: 600;
    color: #0f172a;
  }

  .tiptap-content ul,
  .tiptap-content ol {
    padding-left: 1.5rem;
    margin: 0.5em 0;
  }

  .tiptap-content li {
    margin: 0.25em 0;
  }

  .tiptap-content p {
    margin: 0.5em 0;
  }

  .tiptap-content blockquote {
    border-left: 3px solid #d97706;
    padding-left: 1rem;
    margin: 1em 0;
    color: #64748b;
    font-style: italic;
  }

  .tiptap-content pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    font-size: 0.85rem;
    margin: 1em 0;
  }

  .tiptap-content code {
    background: #f1f5f9;
    padding: 0.15em 0.35em;
    border-radius: 0.25rem;
    font-size: 0.9em;
    color: #dc2626;
  }

  .tiptap-content pre code {
    background: none;
    padding: 0;
    color: inherit;
  }

  .tiptap-content a {
    color: #d97706;
    text-decoration: underline;
  }

  .tiptap-content img {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin: 1em 0;
  }

  .tiptap-content hr {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 1.5em 0;
  }
</style>

<script>
  import { Editor } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import Image from "@tiptap/extension-image";
  import Placeholder from "@tiptap/extension-placeholder";
  import Link from "@tiptap/extension-link";

  document.querySelectorAll(".tiptap-wrapper[data-tiptap-wrapper]").forEach((wrapper) => {
    const toolbar = wrapper.querySelector(".tiptap-toolbar") as HTMLElement;
    const contentEl = wrapper.querySelector("[data-editor-content]") as HTMLElement;
    const outputInput = wrapper.querySelector("[data-tiptap-output]") as HTMLInputElement;
    const placeholderText = contentEl.getAttribute("data-placeholder") || "Start writing...";

    const initialContent = outputInput.value || "";

    const editor = new Editor({
      element: contentEl,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
        }),
        Image.configure({ inline: false, allowBase64: false }),
        Placeholder.configure({ placeholder: placeholderText }),
        Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      ],
      content: initialContent || "",
      autofocus: false,
      editable: true,
      onUpdate: ({ editor }) => {
        outputInput.value = editor.getHTML();
      },
      onTransaction: ({ editor }) => {
        toolbar.querySelectorAll("[data-command]").forEach((btn) => {
          const command = (btn as HTMLElement).getAttribute("data-command");
          if (!command) return;

          let isActive = false;
          switch (command) {
            case "bold": isActive = editor.isActive("bold"); break;
            case "italic": isActive = editor.isActive("italic"); break;
            case "strike": isActive = editor.isActive("strike"); break;
            case "code": isActive = editor.isActive("code"); break;
            case "h2": isActive = editor.isActive("heading", { level: 2 }); break;
            case "h3": isActive = editor.isActive("heading", { level: 3 }); break;
            case "bulletList": isActive = editor.isActive("bulletList"); break;
            case "orderedList": isActive = editor.isActive("orderedList"); break;
            case "blockquote": isActive = editor.isActive("blockquote"); break;
            case "codeBlock": isActive = editor.isActive("codeBlock"); break;
            case "link": isActive = editor.isActive("link"); break;
          }

          btn.classList.toggle("active", isActive);
        });
      },
    });

    // Sync initial content to hidden input
    outputInput.value = editor.getHTML();

    // Toolbar button handlers
    toolbar.querySelectorAll("[data-command]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const command = (btn as HTMLElement).getAttribute("data-command");
        if (!command) return;

        switch (command) {
          case "bold":
            editor.chain().focus().toggleBold().run();
            break;
          case "italic":
            editor.chain().focus().toggleItalic().run();
            break;
          case "strike":
            editor.chain().focus().toggleStrike().run();
            break;
          case "code":
            editor.chain().focus().toggleCode().run();
            break;
          case "h2":
            editor.chain().focus().toggleHeading({ level: 2 }).run();
            break;
          case "h3":
            editor.chain().focus().toggleHeading({ level: 3 }).run();
            break;
          case "bulletList":
            editor.chain().focus().toggleBulletList().run();
            break;
          case "orderedList":
            editor.chain().focus().toggleOrderedList().run();
            break;
          case "blockquote":
            editor.chain().focus().toggleBlockquote().run();
            break;
          case "codeBlock":
            editor.chain().focus().toggleCodeBlock().run();
            break;
          case "horizontalRule":
            editor.chain().focus().setHorizontalRule().run();
            break;
          case "link": {
            const previousUrl = editor.getAttributes("link").href || "";
            const url = window.prompt("Enter URL:", previousUrl);
            if (url === null) break; // cancelled
            if (url === "") {
              editor.chain().focus().unsetLink().run();
            } else {
              editor.chain().focus().setLink({ href: url }).run();
            }
            break;
          }
          case "image": {
            const url = window.prompt("Enter image URL:");
            if (url) {
              editor.chain().focus().setImage({ src: url }).run();
            }
            break;
          }
          case "undo":
            editor.chain().focus().undo().run();
            break;
          case "redo":
            editor.chain().focus().redo().run();
            break;
        }
      });
    });

    // Store editor instance on the wrapper for external access
    (wrapper as any).__tiptapEditor = editor;
  });
</script>
```

- [ ] **Step 2: Verify the component loads without errors**

Run `npm run dev` and open the browser. Navigate to `/admin/blog`. The editor should render with the extended toolbar. No console errors expected.

- [ ] **Step 3: Commit**

```bash
git add src/components/TiptapEditor.astro
git commit -m "feat: upgrade TiptapEditor with extended toolbar and HTML sync"
```

---

### Task 3: Integrate TiptapEditor into ContentEditor for Blog Type

**Files:**
- Modify: `src/components/admin/ContentEditor.astro`

- [ ] **Step 1: Add TiptapEditor import at the top of ContentEditor.astro**

Add this import after the existing `ImageUploader` import (line 2):

```astro
import TiptapEditor from "./TiptapEditor.astro";
```

- [ ] **Step 2: Replace textarea with TiptapEditor for blog type**

Find this block (around lines 98-101):

```astro
<div class="field">
  <label>Details</label>
  <textarea name="content" rows="8" data-content placeholder="Enter full details..."></textarea>
</div>
```

Replace it with:

```astro
<div class="field">
  <label>Details</label>
  {type === 'blog' ? (
    <TiptapEditor id="blog-editor" placeholder="Write your blog post..." />
  ) : (
    <textarea name="content" rows="8" data-content placeholder="Enter full details..."></textarea>
  )}
</div>
```

- [ ] **Step 3: Update fillForm() to set Tiptap editor content for blog type**

In the `fillForm` function (around line 190-215), find:

```javascript
form.querySelector("[data-content]").value = item.content;
```

Replace with:

```javascript
if (type === 'blog') {
  const tiptapWrapper = editor.querySelector("[data-tiptap-wrapper]");
  const tiptapEditor = tiptapWrapper?.__tiptapEditor;
  if (tiptapEditor) {
    tiptapEditor.commands.setContent(item.content || "");
  }
  const outputInput = editor.querySelector("[data-tiptap-output]") as HTMLInputElement;
  if (outputInput) outputInput.value = item.content || "";
} else {
  form.querySelector("[data-content]").value = item.content;
}
```

- [ ] **Step 4: Update form submit to collect content from Tiptap for blog type**

In the form submit handler (around line 448-460), find:

```javascript
const payload = {
  title: form.querySelector("[data-title]").value,
  slug: form.querySelector("[data-slug]").value,
  excerpt: form.querySelector("[data-excerpt]").value,
  content: form.querySelector("[data-content]").value,
  imageUrl: nextImageUrl,
  imageKey: nextImageKey,
  ...(type === 'products' ? {
    category: form.querySelector("[data-category]")?.value || "",
    brand: form.querySelector("[data-brand]")?.value || "",
    model_number: form.querySelector("[data-model]")?.value || ""
  } : {})
};
```

Replace with:

```javascript
let contentValue = "";
if (type === 'blog') {
  const outputInput = editor.querySelector("[data-tiptap-output]") as HTMLInputElement;
  contentValue = outputInput?.value || "";
} else {
  contentValue = (form.querySelector("[data-content]") as HTMLTextAreaElement)?.value || "";
}

const payload = {
  title: form.querySelector("[data-title]").value,
  slug: form.querySelector("[data-slug]").value,
  excerpt: form.querySelector("[data-excerpt]").value,
  content: contentValue,
  imageUrl: nextImageUrl,
  imageKey: nextImageKey,
  ...(type === 'products' ? {
    category: form.querySelector("[data-category]")?.value || "",
    brand: form.querySelector("[data-brand]")?.value || "",
    model_number: form.querySelector("[data-model]")?.value || ""
  } : {})
};
```

- [ ] **Step 5: Update resetForm() to clear Tiptap editor for blog type**

In the `resetForm` function (around line 175-188), find:

```javascript
const resetForm = () => {
  form.reset();
```

Replace with:

```javascript
const resetForm = () => {
  form.reset();
  if (type === 'blog') {
    const tiptapWrapper = editor.querySelector("[data-tiptap-wrapper]");
    const tiptapEditor = tiptapWrapper?.__tiptapEditor;
    if (tiptapEditor) {
      tiptapEditor.commands.clearContent();
    }
    const outputInput = editor.querySelector("[data-tiptap-output]") as HTMLInputElement;
    if (outputInput) outputInput.value = "";
  }
```

- [ ] **Step 6: Test the admin blog editor**

1. Run `npm run dev`
2. Navigate to `/admin/blog`
3. Verify the Tiptap editor appears instead of textarea
4. Type some text, apply bold, italic, headings
5. Add a link, an image URL, a blockquote
6. Click Save — verify the post saves with HTML content
7. Edit an existing post — verify content loads in the editor
8. Click Reset — verify editor clears

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/ContentEditor.astro
git commit -m "feat: integrate TiptapEditor into blog content editor"
```

---

### Task 4: Update Blog Detail Page to Render HTML

**Files:**
- Modify: `src/pages/blog/[slug].astro`

- [ ] **Step 1: Replace newline-split rendering with set:html**

Find this block (lines 26-28):

```astro
<div class="content">
  {post.content.split("\n").filter(Boolean).map((line) => <p>{line}</p>)}
</div>
```

Replace with:

```astro
<div class="content" set:html={post.content}></div>
```

- [ ] **Step 2: Add rich text CSS styles**

Find the existing `<style>` block and replace the `.content p` rule:

```css
.content p { line-height: 1.9; color: #4f4f4f; margin-bottom: 18px; }
```

With expanded rich text styles:

```css
.content { line-height: 1.8; color: #334155; font-size: 1.05rem; }
.content p { margin-bottom: 1em; }
.content h2 { font-size: 1.6rem; margin: 2em 0 0.75em; font-weight: 700; color: #0f172a; }
.content h3 { font-size: 1.3rem; margin: 1.5em 0 0.5em; font-weight: 600; color: #0f172a; }
.content ul, .content ol { padding-left: 1.5rem; margin: 1em 0; }
.content li { margin: 0.35em 0; }
.content blockquote { border-left: 3px solid #d97706; padding-left: 1rem; margin: 1.5em 0; color: #64748b; font-style: italic; }
.content pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.9rem; margin: 1.5em 0; }
.content code { background: #f1f5f9; padding: 0.15em 0.35em; border-radius: 0.25rem; font-size: 0.9em; color: #dc2626; }
.content pre code { background: none; padding: 0; color: inherit; }
.content a { color: #d97706; text-decoration: underline; }
.content a:hover { color: #b45309; }
.content img { max-width: 100%; height: auto; border-radius: 0.75rem; margin: 1.5em 0; }
.content hr { border: none; border-top: 2px solid #e2e8f0; margin: 2em 0; }
```

- [ ] **Step 3: Test the blog detail page**

1. Run `npm run dev`
2. Create a blog post with rich content (headings, lists, blockquote, links, images)
3. View the blog post on `/blog/[slug]`
4. Verify all rich text elements render correctly
5. Check that links open in new tabs (rel="noopener noreferrer")
6. Check responsive layout on mobile

- [ ] **Step 4: Commit**

```bash
git add src/pages/blog/\[slug\].astro
git commit -m "feat: render blog content as HTML with rich text styles"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Full end-to-end test**

1. Run `npm run build` — verify no build errors
2. Run `npm run dev`
3. Login to admin (`/admin/login`)
4. Go to Blog (`/admin/blog`)
5. Create a new post with rich content:
   - Title, slug, excerpt
   - Bold, italic text
   - H2 and H3 headings
   - Bullet and numbered lists
   - Blockquote
   - Code block
   - A link
   - An image URL
   - Horizontal rule
6. Save the post
7. View it on `/blog/[slug]` — verify all elements render
8. Edit the post — verify content loads in editor
9. Delete the post — verify cleanup
10. Check existing blog posts still work (backwards compatibility)

- [ ] **Step 2: Commit final state**

```bash
git add -A
git commit -m "feat: complete blog rich text editor integration"
```
