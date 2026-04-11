# Admin Image Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin panel's two-step image upload flow with a single save-driven flow that compresses in the browser, uploads only on save, and deletes R2 assets on replace, remove, or content deletion.

**Architecture:** Keep the existing Astro admin structure, but extend the content model to store both `image_url` and `image_key`, move image upload orchestration into the editor save flow, and add explicit server-side R2 deletion helpers. The client keeps selected files only in browser state until save, while the server owns durable asset cleanup after content mutations succeed or fail.

**Tech Stack:** Astro, TypeScript/JavaScript in `.astro` scripts, Cloudflare Workers runtime, R2, Neon/Postgres

---

## File Map

**Create**

- `docs/superpowers/plans/2026-04-07-admin-image-lifecycle.md`
- `src/pages/api/upload/delete.ts`

**Modify**

- `src/lib/server/schema.sql`
- `src/lib/server/repository.ts`
- `src/lib/server/api.ts`
- `src/pages/api/upload.ts`
- `src/components/admin/ImageUploader.astro`
- `src/components/admin/ContentEditor.astro`
- `src/pages/admin/products.astro`
- `src/pages/admin/blog.astro`
- `src/pages/admin/index.astro`
- `src/pages/api/products/[id].ts`
- `src/pages/api/blog/[id].ts`
- `src/pages/api/products.ts`
- `src/pages/api/blog.ts`

**Verification**

- `npm run build`

## Task 1: Extend the content schema for deterministic image deletion

**Files:**
- Modify: `src/lib/server/schema.sql`
- Modify: `src/lib/server/repository.ts`

- [ ] **Step 1: Add `image_key` columns to content tables that support admin image uploads**

Update `src/lib/server/schema.sql` so the persisted content model includes a stable object key:

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_key TEXT NOT NULL DEFAULT '';
ALTER TABLE parts ADD COLUMN IF NOT EXISTS image_key TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS image_key TEXT NOT NULL DEFAULT '';
```

- [ ] **Step 2: Extend repository types to include `imageKey`**

Update `src/lib/server/repository.ts` type definitions:

```ts
export type ContentRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  imageKey: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  brand?: string;
  model_number?: string;
};

export type ContentInput = {
  title: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  imageKey?: string;
  slug?: string;
  category?: string;
  brand?: string;
  model_number?: string;
};
```

- [ ] **Step 3: Map `image_key` in reads and writes**

Update `mapRecord`, `createContent`, and `updateContent` so all content reads and writes carry `image_key`:

```ts
imageUrl: String(row.image_url ?? ""),
imageKey: String(row.image_key ?? ""),
```

and include `image_key` in `INSERT`/`UPDATE` parameter lists for each content type.

- [ ] **Step 4: Run a build to verify schema-aware code still compiles**

Run: `npm run build`

Expected: build completes successfully without type or syntax errors.

## Task 2: Add server-side asset deletion primitives

**Files:**
- Create: `src/pages/api/upload/delete.ts`
- Modify: `src/pages/api/upload.ts`
- Modify: `src/lib/server/api.ts`

- [ ] **Step 1: Ensure upload API returns both public URL and exact object key**

Confirm or update `src/pages/api/upload.ts` to return:

```ts
return Response.json({ url: publicUrl, key: objectKey });
```

- [ ] **Step 2: Accept `imageKey` in content API payload typing**

Update request payload shapes in `src/lib/server/api.ts`:

```ts
const body = await readJson<{
  title: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  imageKey?: string;
  slug?: string;
  category?: string;
  brand?: string;
  model_number?: string;
}>(context.request);
```

- [ ] **Step 3: Add an authenticated delete endpoint for explicit R2 cleanup**

Create `src/pages/api/upload/delete.ts`:

```ts
import type { APIRoute } from "astro";
import { readJson, requireAdminRequest } from "../../../lib/server/api";

export const POST: APIRoute = async (context) => {
  try {
    const env = await requireAdminRequest(context);
    if (!env) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await readJson<{ key?: string }>(context.request);
    const key = body.key?.trim();

    if (!key) {
      return Response.json({ error: "Missing key." }, { status: 400 });
    }

    await env.MEDIA_BUCKET.delete(key);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Delete failed." }, { status: 500 });
  }
};
```

- [ ] **Step 4: Run build to verify the new endpoint compiles**

Run: `npm run build`

Expected: build completes and includes the new delete route.

## Task 3: Make the image uploader a single-save input with local preview only

**Files:**
- Modify: `src/components/admin/ImageUploader.astro`
- Modify: `src/components/admin/ContentEditor.astro`

- [ ] **Step 1: Simplify the uploader component API**

Replace the current upload button UI in `src/components/admin/ImageUploader.astro` with one file input, one remove button, one hidden `imageUrl`, one hidden `imageKey`, and preview/status hooks:

```astro
<div class="image-uploader">
  <label>{label}</label>
  <input type="file" accept="image/*" data-image-input />
  <button type="button" class="secondary-btn" data-image-remove-btn>Remove Image</button>
  <p class="upload-status" data-upload-status></p>
  <input type="hidden" name="imageUrl" data-image-url />
  <input type="hidden" name="imageKey" data-image-key />
</div>
```

- [ ] **Step 2: Add explicit editor-side image session state**

Inside `src/components/admin/ContentEditor.astro`, add state variables:

```js
let selectedFile = null;
let selectedPreviewUrl = "";
let existingImageUrl = "";
let existingImageKey = "";
let imageRemoved = false;
```

- [ ] **Step 3: Add preview lifecycle helpers**

Implement helpers in `src/components/admin/ContentEditor.astro`:

```js
const clearPreviewUrl = () => {
  if (selectedPreviewUrl) {
    URL.revokeObjectURL(selectedPreviewUrl);
    selectedPreviewUrl = "";
  }
};

const setExistingImageState = (url, key) => {
  existingImageUrl = url || "";
  existingImageKey = key || "";
};
```

Also update `drawPreview` to prefer the local preview when a new file is selected.

- [ ] **Step 4: Handle file selection without uploading**

Replace the current upload button event with a file input change handler:

```js
imageInput?.addEventListener("change", () => {
  const file = imageInput.files?.[0] ?? null;
  clearPreviewUrl();
  selectedFile = file;
  imageRemoved = false;

  if (file) {
    selectedPreviewUrl = URL.createObjectURL(file);
    drawPreview(selectedPreviewUrl);
    uploadStatus.textContent = "Image selected. It will be compressed and uploaded when you save.";
  } else {
    drawPreview(existingImageUrl);
    uploadStatus.textContent = "";
  }
});
```

- [ ] **Step 5: Add remove-image behavior**

Add a remove handler in `src/components/admin/ContentEditor.astro`:

```js
imageRemoveBtn?.addEventListener("click", () => {
  clearPreviewUrl();
  selectedFile = null;
  imageRemoved = true;
  if (imageInput) {
    imageInput.value = "";
  }
  imageUrlInput.value = "";
  imageKeyInput.value = "";
  drawPreview("");
  uploadStatus.textContent = "Image will be removed when you save.";
});
```

- [ ] **Step 6: Make reset restore the saved image instead of wiping blindly**

Update `resetForm`:

```js
const resetForm = () => {
  form.reset();
  form.querySelector("[data-id]").value = "";
  clearPreviewUrl();
  selectedFile = null;
  imageRemoved = false;
  setExistingImageState("", "");
  imageUrlInput.value = "";
  imageKeyInput.value = "";
  statusEl.textContent = "";
  uploadStatus.textContent = "";
  drawPreview("");
};
```

and update `fillForm(item)` to restore persisted image state:

```js
setExistingImageState(item.imageUrl || "", item.imageKey || "");
imageUrlInput.value = item.imageUrl || "";
imageKeyInput.value = item.imageKey || "";
drawPreview(item.imageUrl || "");
```

- [ ] **Step 7: Run build after the UI state refactor**

Run: `npm run build`

Expected: build completes successfully and the admin editor still renders.

## Task 4: Move compression and upload into the save action

**Files:**
- Modify: `src/components/admin/ContentEditor.astro`

- [ ] **Step 1: Keep the existing browser compression helper and make it return a file**

Preserve the current `compressImageToWebp(file)` helper, but use it only from submit flow.

- [ ] **Step 2: Add a dedicated helper to upload an already-compressed file**

Add:

```js
const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Image upload failed.");
  }

  return await response.json();
};
```

- [ ] **Step 3: Add a helper to delete by exact object key**

Add:

```js
const deleteImageByKey = async (key) => {
  if (!key) {
    return;
  }

  await fetch("/api/upload/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key })
  });
};
```

- [ ] **Step 4: Update form submit to upload only when needed**

Restructure submit flow around these branches:

```js
let nextImageUrl = existingImageUrl;
let nextImageKey = existingImageKey;
let uploadedKeyToRollback = "";

if (selectedFile) {
  uploadStatus.textContent = "Compressing image...";
  const compressed = await compressImageToWebp(selectedFile);
  uploadStatus.textContent = "Uploading image...";
  const uploaded = await uploadImage(compressed);
  nextImageUrl = uploaded.url;
  nextImageKey = uploaded.key;
  uploadedKeyToRollback = uploaded.key;
}

if (imageRemoved) {
  nextImageUrl = "";
  nextImageKey = "";
}
```

- [ ] **Step 5: Include `imageUrl` and `imageKey` in the save payload**

Update the payload:

```js
const payload = {
  title: form.querySelector("[data-title]").value,
  slug: form.querySelector("[data-slug]").value,
  excerpt: form.querySelector("[data-excerpt]").value,
  content: form.querySelector("[data-content]").value,
  imageUrl: nextImageUrl,
  imageKey: nextImageKey,
  ...(type === "products" ? {
    category: form.querySelector("[data-category]")?.value || "",
    brand: form.querySelector("[data-brand]")?.value || "",
    model_number: form.querySelector("[data-model]")?.value || ""
  } : {})
};
```

- [ ] **Step 6: Roll back newly uploaded objects if content save fails**

Wrap submit in `try/catch`:

```js
try {
  // upload if needed
  // save content
} catch (error) {
  if (uploadedKeyToRollback) {
    await deleteImageByKey(uploadedKeyToRollback);
  }
  statusEl.textContent = error instanceof Error ? error.message : "Save failed.";
  return;
}
```

- [ ] **Step 7: Delete replaced or removed old images only after successful save**

After a successful save response:

```js
const shouldDeleteOldImage =
  existingImageKey &&
  existingImageKey !== nextImageKey &&
  (selectedFile || imageRemoved);

if (shouldDeleteOldImage) {
  await deleteImageByKey(existingImageKey);
}
```

- [ ] **Step 8: Refresh local editor state after successful save**

After save:

```js
setExistingImageState(nextImageUrl, nextImageKey);
imageUrlInput.value = nextImageUrl;
imageKeyInput.value = nextImageKey;
clearPreviewUrl();
selectedFile = null;
imageRemoved = false;
```

- [ ] **Step 9: Run build to verify the single-save workflow compiles**

Run: `npm run build`

Expected: build completes and no removed upload button references remain.

## Task 5: Ensure content deletion also deletes linked R2 objects

**Files:**
- Modify: `src/lib/server/repository.ts`
- Modify: `src/lib/server/api.ts`

- [ ] **Step 1: Add a repository helper that loads a record before deletion**

In `src/lib/server/repository.ts`, keep `getContentById` available and use it from delete handlers.

- [ ] **Step 2: Update delete route logic to delete the content image after record removal**

In `src/lib/server/api.ts`, update the delete branch inside `createDetailHandler(type)`:

```ts
if (context.request.method === "DELETE") {
  const existingItem = await getContentById(env, type, id);
  await deleteContent(env, type, id);

  if (existingItem?.imageKey) {
    try {
      await env.MEDIA_BUCKET.delete(existingItem.imageKey);
    } catch (error) {
      console.error("Failed to delete media object", existingItem.imageKey, error);
    }
  }

  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Import the required repository helper**

Update imports in `src/lib/server/api.ts`:

```ts
import {
  createContent,
  deleteContent,
  getContentById,
  listContent,
  updateContent,
  type ContentType
} from "./repository";
```

- [ ] **Step 4: Run build to verify delete flow compiles**

Run: `npm run build`

Expected: build completes and delete handlers compile with `getContentById`.

## Task 6: Make list and edit views surface the saved image state cleanly

**Files:**
- Modify: `src/components/admin/ContentEditor.astro`
- Modify: `src/pages/admin/index.astro`
- Modify: `src/pages/admin/blog.astro`
- Modify: `src/pages/admin/products.astro`

- [ ] **Step 1: Ensure API list rendering uses `imageKey`-aware records without regressions**

Keep the card rendering stable, but ensure `fillForm(item)` receives both `imageUrl` and `imageKey` from API list responses.

- [ ] **Step 2: Update admin copy to reflect the new one-step image workflow**

Add short helper text in the editor header or image field:

```astro
<p>Select an image and click Save. Compression and upload happen automatically.</p>
```

- [ ] **Step 3: Update dashboard/admin wording if needed**

If dashboard or admin pages mention manual upload behavior, remove that wording. For example, adjust text in `src/pages/admin/index.astro` and `src/pages/admin/blog.astro` to avoid implying a separate upload stage.

- [ ] **Step 4: Run build to verify no stale markup references remain**

Run: `npm run build`

Expected: build completes and admin pages render without missing selector errors.

## Task 7: End-to-end verification

**Files:**
- Modify: none
- Test: manual verification in local admin UI

- [ ] **Step 1: Verify create with image**

Run: `npm run build`

Then manually confirm:

- select image
- preview appears immediately
- click `Save`
- record saves
- image loads after reload

- [ ] **Step 2: Verify reset before save**

Manually confirm:

- open create form
- select image
- click `Reset`
- preview clears
- no request to `/api/upload` occurs before save

- [ ] **Step 3: Verify replace existing image**

Manually confirm:

- open existing item with image
- select a different image
- save
- new image is shown
- old R2 key is deleted

- [ ] **Step 4: Verify remove existing image**

Manually confirm:

- open existing item with image
- click remove image
- save
- image disappears after reload
- old R2 key is deleted

- [ ] **Step 5: Verify content deletion removes linked image**

Manually confirm:

- delete an item with image
- item disappears from list
- linked R2 object no longer exists

- [ ] **Step 6: Verify failure rollback**

Temporarily simulate a failing content save after upload, then confirm:

- upload happens during save
- content save fails
- newly uploaded image is deleted via `/api/upload/delete`

