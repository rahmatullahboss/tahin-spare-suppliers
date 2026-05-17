# Subcategory System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parent-child category system supporting subcategories, initially for "Spare Parts", extensible to all categories.

**Architecture:** Self-referencing `parent_id` on the existing `categories` table. Top-level categories have `parent_id = NULL`. Subcategories point to their parent. Products link to subcategories via a `subcategory` text field. Max 2 levels deep.

**Tech Stack:** Astro, Neon (PostgreSQL), vanilla JS (client-side), R2 (image storage)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/server/schema.sql` | Modify | Add `parent_id` to categories, `subcategory` to products |
| `src/lib/categories.ts` | Modify | Add `parentId` to types, update `mergeCategories` |
| `src/lib/server/categories.ts` | Modify | Add subcategory CRUD, update queries |
| `src/lib/server/repository.ts` | Modify | Add `subcategory` to product types and queries |
| `src/lib/server/api.ts` | Modify | Add `subcategory` to API handler types |
| `src/pages/api/admin/categories.ts` | Modify | Add `parentId` to API body type |
| `src/pages/admin/categories.astro` | Modify | Add parent dropdown, nested list display |
| `src/pages/admin/products.astro` | Modify | Pass subcategories to ContentEditor |
| `src/components/admin/ContentEditor.astro` | Modify | Add subcategory dropdown |
| `src/pages/category/[category].astro` | Modify | Show subcategory cards above products |
| `src/pages/category/[category]/[subcategory].astro` | Create | New page for subcategory products |

---

## Task 1: Schema Migration

**Files:**
- Modify: `src/lib/server/schema.sql`

- [ ] **Step 1: Add `parent_id` column to categories table**

Open `src/lib/server/schema.sql` and append at the end:

```sql
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES categories(id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
```

- [ ] **Step 2: Add `subcategory` column to products table**

Append right after:

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/schema.sql
git commit -m "feat: add parent_id to categories and subcategory to products schema"
```

---

## Task 2: Update Shared Types

**Files:**
- Modify: `src/lib/categories.ts`

- [ ] **Step 1: Add `parentId` to `CustomCategory` type**

In `src/lib/categories.ts`, find the `CustomCategory` type (around line 33) and add `parentId`:

```typescript
export type CustomCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  imageKey: string;
  parentId: string;
  createdAt: string;
};
```

- [ ] **Step 2: Add `parentId` to `DisplayCategory` type**

Find the `DisplayCategory` type (around line 42) and add `parentId`:

```typescript
export type DisplayCategory = {
  id?: string;
  value: string;
  slug: string;
  imageUrl: string;
  imageKey: string;
  parentId?: string;
  createdAt?: string;
  isDefault: boolean;
};
```

- [ ] **Step 3: Update `mergeCategories` to pass through `parentId`**

Find the `mergeCategories` function. In the custom category mapping (where `isDefault: false` is set), add `parentId: cat.parentId`:

```typescript
export function mergeCategories(customCategories: CustomCategory[] = []): DisplayCategory[] {
  const defaults: DisplayCategory[] = EQUIPMENT_CATEGORIES.map((cat) => ({
    value: cat.value,
    slug: cat.slug,
    imageUrl: CATEGORY_IMAGES[cat.slug] ?? DEFAULT_CATEGORY_IMAGE,
    imageKey: "",
    isDefault: true,
  }));

  const customs: DisplayCategory[] = customCategories.map((cat) => ({
    id: cat.id,
    value: cat.name,
    slug: cat.slug,
    imageUrl: cat.imageUrl || DEFAULT_CATEGORY_IMAGE,
    imageKey: cat.imageKey,
    parentId: cat.parentId,
    createdAt: cat.createdAt,
    isDefault: false,
  }));

  return [...defaults, ...customs];
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/categories.ts
git commit -m "feat: add parentId to category types"
```

---

## Task 3: Server-Side Category CRUD with Subcategory Support

**Files:**
- Modify: `src/lib/server/categories.ts`

- [ ] **Step 1: Update `CategoryInput` type**

In `src/lib/server/categories.ts`, find `CategoryInput` (around line 6) and add `parentId`:

```typescript
type CategoryInput = {
  name: string;
  imageUrl?: string;
  imageKey?: string;
  parentId?: string;
};
```

- [ ] **Step 2: Update `mapCustomCategory` to include `parentId`**

Find `mapCustomCategory` function (around line 12) and add `parentId`:

```typescript
function mapCustomCategory(row: Record<string, unknown>): CustomCategory {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    imageUrl: String(row.image_url ?? ""),
    imageKey: String(row.image_key ?? ""),
    parentId: String(row.parent_id ?? ""),
    createdAt: String(row.created_at)
  };
}
```

- [ ] **Step 3: Update `normalizeCategoryInput` to handle `parentId`**

Update `normalizeCategoryInput` to accept and pass through `parentId`:

```typescript
function normalizeCategoryInput(input: CategoryInput) {
  const name = input.name.trim();
  const slug = slugify(name);

  if (!name) {
    throw new Error("Name is required");
  }

  if (!slug) {
    throw new Error("Name must contain at least one letter or number");
  }

  if (isReservedCategorySlug(slug)) {
    throw new Error("Default category names are reserved");
  }

  return {
    name,
    slug,
    imageUrl: input.imageUrl?.trim() ?? "",
    imageKey: input.imageKey?.trim() ?? "",
    parentId: input.parentId?.trim() ?? ""
  };
}
```

- [ ] **Step 4: Update `listCustomCategories` to return only top-level categories**

Change the query to filter `parent_id IS NULL`:

```typescript
export async function listCustomCategories(env: RuntimeEnv): Promise<CustomCategory[]> {
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(`SELECT id, name, slug, image_url, image_key, parent_id, created_at FROM categories WHERE parent_id IS NULL ORDER BY name`);
  return rows.map((row) => mapCustomCategory(row));
}
```

- [ ] **Step 5: Add `listSubcategories` function**

Add this new function after `listCustomCategories`:

```typescript
export async function listSubcategories(env: RuntimeEnv, parentId: string): Promise<CustomCategory[]> {
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `SELECT id, name, slug, image_url, image_key, parent_id, created_at FROM categories WHERE parent_id = $1 ORDER BY name`,
    [parentId]
  );
  return rows.map((row) => mapCustomCategory(row));
}
```

- [ ] **Step 6: Add `listAllSubcategories` function**

Add this function to get all subcategories (for admin UI):

```typescript
export async function listAllSubcategories(env: RuntimeEnv): Promise<CustomCategory[]> {
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `SELECT id, name, slug, image_url, image_key, parent_id, created_at FROM categories WHERE parent_id IS NOT NULL ORDER BY name`
  );
  return rows.map((row) => mapCustomCategory(row));
}
```

- [ ] **Step 7: Update `createCustomCategory` to handle `parentId`**

Update the insert query to include `parent_id`. Also validate that if `parentId` is set, the parent exists and is a top-level category:

```typescript
export async function createCustomCategory(env: RuntimeEnv, input: CategoryInput): Promise<CustomCategory> {
  await ensureSchema(env);
  const sql = getDb(env);
  const { name, slug, imageUrl, imageKey, parentId } = normalizeCategoryInput(input);

  // Validate parent if provided
  if (parentId) {
    const parentRows = await sql.query(
      `SELECT id, parent_id FROM categories WHERE id = $1`,
      [parentId]
    );
    if (parentRows.length === 0) {
      throw new Error("Parent category not found");
    }
    if (parentRows[0].parent_id) {
      throw new Error("Cannot create subcategory under a subcategory");
    }
  }

  const id = crypto.randomUUID();
  const rows = await sql.query(
    `INSERT INTO categories (id, name, slug, image_url, image_key, parent_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [id, name, slug, imageUrl, imageKey, parentId || null]
  );
  return mapCustomCategory(rows[0]);
}
```

- [ ] **Step 8: Update `updateCustomCategory` to handle `parentId`**

```typescript
export async function updateCustomCategory(
  env: RuntimeEnv,
  id: string,
  input: CategoryInput
): Promise<CustomCategory | null> {
  await ensureSchema(env);
  const sql = getDb(env);
  const { name, slug, imageUrl, imageKey, parentId } = normalizeCategoryInput(input);

  // Validate parent if provided
  if (parentId) {
    if (parentId === id) {
      throw new Error("Category cannot be its own parent");
    }
    const parentRows = await sql.query(
      `SELECT id, parent_id FROM categories WHERE id = $1`,
      [parentId]
    );
    if (parentRows.length === 0) {
      throw new Error("Parent category not found");
    }
    if (parentRows[0].parent_id) {
      throw new Error("Cannot create subcategory under a subcategory");
    }
  }

  const rows = await sql.query(
    `UPDATE categories SET name = $1, slug = $2, image_url = $3, image_key = $4, parent_id = $5 WHERE id = $6 RETURNING *`,
    [name, slug, imageUrl, imageKey, parentId || null, id]
  );
  return rows[0] ? mapCustomCategory(rows[0]) : null;
}
```

- [ ] **Step 9: Update `deleteCustomCategory` to cascade delete subcategories**

```typescript
export async function deleteCustomCategory(env: RuntimeEnv, id: string): Promise<boolean> {
  await ensureSchema(env);
  const sql = getDb(env);

  // Delete subcategories first
  await sql.query(`DELETE FROM categories WHERE parent_id = $1`, [id]);

  const rows = await sql.query(
    `DELETE FROM categories WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows.length > 0;
}
```

- [ ] **Step 10: Add `findSubcategoryBySlug` function**

Add this new function for the subcategory page route:

```typescript
export async function findSubcategoryBySlug(
  env: RuntimeEnv,
  parentSlug: string,
  subcategorySlug: string
): Promise<{ parent: DisplayCategory; subcategory: DisplayCategory } | null> {
  const parent = await findCategoryBySlug(env, parentSlug);
  if (!parent || !parent.id) return null;

  const subcategories = await listSubcategories(env, parent.id);
  const subcategory = subcategories.find((s) => s.slug === subcategorySlug);
  if (!subcategory) return null;

  return {
    parent,
    subcategory: {
      id: subcategory.id,
      value: subcategory.name,
      slug: subcategory.slug,
      imageUrl: subcategory.imageUrl || parent.imageUrl,
      imageKey: subcategory.imageKey,
      parentId: subcategory.parentId,
      createdAt: subcategory.createdAt,
      isDefault: false,
    },
  };
}
```

- [ ] **Step 11: Commit**

```bash
git add src/lib/server/categories.ts
git commit -m "feat: add subcategory CRUD functions to server"
```

---

## Task 4: Update Product Repository for Subcategory

**Files:**
- Modify: `src/lib/server/repository.ts`

- [ ] **Step 1: Add `subcategory` to `ContentRecord` type**

In `src/lib/server/repository.ts`, find `ContentRecord` (around line 20) and add `subcategory`:

```typescript
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
  subcategory?: string;
  brand?: string;
  model_number?: string;
};
```

- [ ] **Step 2: Add `subcategory` to `ContentInput` type**

Find `ContentInput` (around line 35) and add `subcategory`:

```typescript
export type ContentInput = {
  title: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  imageKey?: string;
  slug?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  model_number?: string;
};
```

- [ ] **Step 3: Update `mapRecord` to include `subcategory`**

In the `mapRecord` function, find the products-specific mapping (around line 60) and add `subcategory`:

```typescript
...(type === 'products' ? {
  category: String(row.category ?? "Uncategorized"),
  subcategory: String(row.subcategory ?? ""),
  brand: String(row.brand ?? ""),
  model_number: String(row.model_number ?? "")
} : {})
```

- [ ] **Step 4: Update `createContent` to include `subcategory`**

In `createContent`, find the products-specific insert query (around line 142) and add `subcategory`:

```typescript
if (type === 'products') {
  const subcategory = input.subcategory ?? "";
  query = `INSERT INTO ${config.table} (id, slug, ${config.titleColumn}, ${config.excerptColumn}, content, image_url, image_key, category, subcategory, brand, model_number, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     RETURNING *`;
  params = [id, slug, input.title, excerpt, content, imageUrl, imageKey, category, subcategory, brand, model_number];
}
```

- [ ] **Step 5: Update `updateContent` to include `subcategory`**

In `updateContent`, find the products-specific update query (around line 184) and add `subcategory`:

```typescript
if (type === 'products') {
  const subcategory = input.subcategory ?? "";
  query = `UPDATE ${config.table}
     SET slug = $1,
         ${config.titleColumn} = $2,
         ${config.excerptColumn} = $3,
         content = $4,
         image_url = $5,
         image_key = $6,
         category = $7,
         subcategory = $8,
         brand = $9,
         model_number = $10,
         updated_at = NOW()
     WHERE id = $11
     RETURNING *`;
  params = [slug, input.title, excerpt, content, imageUrl, imageKey, category, subcategory, brand, model_number, id];
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/repository.ts
git commit -m "feat: add subcategory to product repository"
```

---

## Task 5: Update API Handlers

**Files:**
- Modify: `src/lib/server/api.ts`
- Modify: `src/pages/api/admin/categories.ts`

- [ ] **Step 1: Add `subcategory` to API handler types in `api.ts`**

In `src/lib/server/api.ts`, find the body type in `createListHandler` (around line 56) and `createDetailHandler` (around line 112). Add `subcategory` to both:

In `createListHandler`:
```typescript
const body = await readJson<{
  title: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  imageKey?: string;
  slug?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  model_number?: string;
}>(context.request);
```

In `createDetailHandler`:
```typescript
const body = await readJson<{
  title: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  imageKey?: string;
  slug?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  model_number?: string;
}>(context.request);
```

- [ ] **Step 2: Add `parentId` to categories API body type**

In `src/pages/api/admin/categories.ts`, find `CategoryBody` (around line 10) and add `parentId`:

```typescript
type CategoryBody = {
  id?: string;
  name?: string;
  imageUrl?: string;
  imageKey?: string;
  parentId?: string;
};
```

- [ ] **Step 3: Update `getCategoryInput` to include `parentId`**

In the same file, find `getCategoryInput` (around line 21) and add `parentId`:

```typescript
function getCategoryInput(body: CategoryBody) {
  return {
    name: body.name ?? "",
    imageUrl: body.imageUrl ?? "",
    imageKey: body.imageKey ?? "",
    parentId: body.parentId ?? ""
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/api.ts src/pages/api/admin/categories.ts
git commit -m "feat: add subcategory and parentId to API handlers"
```

---

## Task 6: Admin Categories UI - Parent Dropdown

**Files:**
- Modify: `src/pages/admin/categories.astro`

- [ ] **Step 1: Add `listAllSubcategories` import and fetch**

Update the imports to include `listAllSubcategories`, then fetch subcategories:

```astro
import { listCustomCategories, listAllSubcategories } from "../../lib/server/categories";
```

After `const customCategories = await listCustomCategories(env);` add:
```astro
const allSubcategories = await listAllSubcategories(env);
```

- [ ] **Step 2: Add parent dropdown to the form**

Find the form section. Add a parent category dropdown after the hidden input, before the name field:

```astro
<div class="field">
  <label for="category-parent">Parent Category (optional)</label>
  <select id="category-parent">
    <option value="">-- Top-level category --</option>
    {defaultCategories.map((cat) => (
      <option value={cat.value}>{cat.value}</option>
    ))}
    {customCategories.map((cat) => (
      <option value={cat.id}>{cat.name}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 3: Update custom categories list to show nested subcategories**

Replace the custom categories section with a nested display that groups each custom category with its subcategories. Each subcategory is indented with a visual left border.

For each custom category, filter `allSubcategories` where `parentId === category.id` and render them in a nested `<div class="subcategory-list">` container.

- [ ] **Step 4: Update the JavaScript to handle `parentId`**

In the form submit handler, read the parent dropdown value and include it in the payload:
```javascript
const parentSelect = document.getElementById("category-parent");
const parentId = parentSelect ? parentSelect.value : "";
```

In the payload object, add: `parentId: parentId`

In the edit click handler, set the parent dropdown:
```javascript
const parentSelect = document.getElementById("category-parent");
if (parentSelect) parentSelect.value = button.getAttribute("data-edit-parent") || "";
```

In the reset handler, clear the parent dropdown.

- [ ] **Step 5: Add CSS for nested subcategory display**

Add styles for `.category-group`, `.subcategory-list` (with left border indent), and `.subcategory-card` (with lighter background).

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/categories.astro
git commit -m "feat: add parent dropdown and nested subcategory list to admin categories"
```

---

## Task 7: Admin Products UI - Subcategory Dropdown

**Files:**
- Modify: `src/pages/admin/products.astro`
- Modify: `src/components/admin/ContentEditor.astro`

- [ ] **Step 1: Fetch subcategories in products page**

In `src/pages/admin/products.astro`, add import for `listAllSubcategories`, fetch subcategories, and pass as prop:

```astro
import { listAllCategories, listAllSubcategories } from "../../lib/server/categories";

const subcategories = await listAllSubcategories(env);
```

Pass `subcategories={subcategories}` to ContentEditor.

- [ ] **Step 2: Add `subcategories` prop to ContentEditor**

In `src/components/admin/ContentEditor.astro`, update Props interface:
```typescript
subcategories?: { id: string; name: string; parentId: string }[];
```

Destructure it with default `[]`.

- [ ] **Step 3: Add subcategory dropdown to the form**

After the category select field, add a hidden subcategory field:
```astro
<div class="field" data-subcategory-field style="display: none;">
  <label>Subcategory</label>
  <select name="subcategory" data-subcategory>
    <option value="">-- None --</option>
  </select>
</div>
```

- [ ] **Step 4: Add JavaScript for dynamic subcategory dropdown**

Add logic to show/hide and populate the subcategory dropdown when category changes. Use `categorySelect.addEventListener("change", ...)` to filter subcategories by parent ID and update the dropdown options.

- [ ] **Step 5: Update `fillForm` to set subcategory**

After setting category value in `fillForm`, call the subcategory update function and set the subcategory value with a small delay (setTimeout) to allow the dropdown to populate.

- [ ] **Step 6: Update form submission payload**

In the submit handler payload, add: `subcategory: form.querySelector("[data-subcategory]")?.value || ""`

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/products.astro src/components/admin/ContentEditor.astro
git commit -m "feat: add subcategory dropdown to product editor"
```

---

## Task 8: Public Category Page - Subcategory Cards

**Files:**
- Modify: `src/pages/category/[category].astro`

- [ ] **Step 1: Fetch subcategories for the current category**

Update imports to include `listSubcategories`. After finding the current category, fetch its subcategories:

```astro
import { findCategoryBySlug, listSubcategories } from '../../lib/server/categories';

const subcategories = currentCategory.id
  ? await listSubcategories(env, currentCategory.id)
  : [];
```

- [ ] **Step 2: Add subcategory cards section**

Above the products grid, add a conditional section that shows subcategory cards when subcategories exist. Each card links to `/category/{category}/{subcategory.slug}`.

- [ ] **Step 3: Add CSS for subcategory cards**

Add styles for `.subcategory-grid` (CSS grid), `.subcategory-card` (card with image + title), hover effects.

- [ ] **Step 4: Commit**

```bash
git add src/pages/category/[category].astro
git commit -m "feat: show subcategory cards on category page"
```

---

## Task 9: New Subcategory Page

**Files:**
- Create: `src/pages/category/[category]/[subcategory].astro`

- [ ] **Step 1: Create the subcategory page**

Create a new Astro page that:
1. Uses `findSubcategoryBySlug` to resolve parent + subcategory
2. Filters products by `category === parent.value && subcategory === currentSubcategory.value`
3. Shows breadcrumb: Products > Category > Subcategory
4. Shows product grid with same layout as category page
5. Shows brand links section
6. Shows enquiry CTA
7. Includes FAQ schema for SEO

- [ ] **Step 2: Commit**

```bash
git add src/pages/category/[category]/[subcategory].astro
git commit -m "feat: add subcategory page at /category/[category]/[subcategory]"
```

---

## Task 10: Verification

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Test admin categories page**

1. Go to `/admin/categories`
2. Verify parent dropdown appears
3. Create a subcategory under "Spare Parts"
4. Verify nested display
5. Edit and delete the subcategory

- [ ] **Step 3: Test admin products page**

1. Go to `/admin/products`
2. Create/edit a product with category "Spare Parts"
3. Verify subcategory dropdown appears
4. Save with subcategory selected

- [ ] **Step 4: Test public pages**

1. Visit `/category/spare-parts` - verify subcategory cards appear
2. Click a subcategory card - verify navigation works
3. Verify products are filtered correctly
4. Verify breadcrumb navigation

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete subcategory system implementation"
```
