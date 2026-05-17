# Subcategory System Design

**Date:** 2026-05-17
**Status:** Approved

## Overview

Add a general-purpose parent-child category system to support subcategories. Initially populated under "Spare Parts" only, but designed to extend to any category later.

## Architecture

### Approach: Self-referencing `parent_id` on `categories` table

- Top-level categories: `parent_id = NULL`
- Subcategories: `parent_id` points to parent category
- Maximum 2 levels deep (no sub-subcategories)
- Products link to subcategories via `subcategory` text field

## Schema Changes

### `categories` table

```sql
ALTER TABLE categories ADD COLUMN parent_id TEXT REFERENCES categories(id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
```

### `products` table

```sql
ALTER TABLE products ADD COLUMN subcategory TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_products_subcategory ON products(subcategory);
```

### Data Model

| Entity | Example |
|--------|---------|
| Top-level category | `id: "abc"`, `name: "Spare Parts"`, `parent_id: NULL` |
| Subcategory | `id: "def"`, `name: "Engine Parts"`, `parent_id: "abc"` |
| Product | `category: "Spare Parts"`, `subcategory: "Engine Parts"` |

## Server Logic

### `src/lib/categories.ts` changes

- Add `parentId?: string` to `CustomCategory` type
- Add `parentId?: string` to `DisplayCategory` type
- Update `mergeCategories()` to include `parentId`

### `src/lib/server/categories.ts` changes

- Add `parentId?: string` to `CategoryInput` type
- Add `listSubcategories(env, parentId)` function
- Update `listCustomCategories()` to return only top-level categories (`parent_id IS NULL`)
- Update `createCustomCategory()` to insert `parent_id`
- Update `updateCustomCategory()` to update `parent_id`
- Update `deleteCustomCategory()` to cascade delete subcategories
- Add `findCategoryBySlug()` to handle subcategory slugs (e.g., `spare-parts/engine-parts`)

### Validation Rules

- Subcategory name must be unique within its parent (not globally)
- Subcategory slug format: `parent-slug/subcategory-slug` (e.g., `/spare-parts/engine-parts`)
- Maximum 2 levels deep — cannot create subcategory under a subcategory
- Default categories cannot be subcategories (they are top-level only)

## Admin UI

### `/admin/categories` page

**Form changes:**
- Add "Parent Category" dropdown (optional)
- Dropdown shows only top-level categories (default + custom)
- If parent selected → creates subcategory
- If no parent → creates top-level category (current behavior)

**List changes:**
- Show top-level categories first
- Each category shows its subcategories indented below
- Subcategories have Edit/Delete buttons
- Visual indicator for subcategory nesting (indent + icon)

### `/admin/products` page

**Form changes:**
- When category is "Spare Parts" (or any category with subcategories), show subcategory dropdown
- Subcategory dropdown loads dynamically based on selected category
- Optional — product can exist without subcategory

## Public Pages

### `/products` page

No changes. Subcategories appear when visiting a category page.

### `/category/[category]` page

**If category has subcategories:**
- Show subcategory cards grid above products
- Each card: image + name
- Click → navigates to `/category/[category]/[subcategory]`

**If no subcategories:**
- Current behavior (products grid directly)

### `/category/[category]/[subcategory]` page (NEW)

- Shows filtered products for that subcategory
- Same layout as current category page
- Breadcrumb: Products > Category > Subcategory
- FAQ schema generated for subcategory
- Brand SEO links for subcategory

### URL Structure

| URL | Content |
|-----|---------|
| `/category/spare-parts` | Subcategory cards + all spare parts products |
| `/category/spare-parts/engine-parts` | Engine Parts products only |
| `/category/marine-propulsion-engine` | Products directly (no subcategories) |

## Implementation Order

1. Schema migration (add `parent_id` to categories, `subcategory` to products)
2. Server logic (types, CRUD functions, validation)
3. Admin categories UI (parent dropdown, nested list)
4. Admin products UI (subcategory dropdown)
5. Public category page (subcategory cards)
6. New subcategory page (`/category/[category]/[subcategory]`)
