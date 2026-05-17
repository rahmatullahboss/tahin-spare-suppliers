import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CATEGORY_IMAGE,
  EQUIPMENT_CATEGORIES,
  findCategoryBySlug,
  getCategorySlug,
  isReservedCategorySlug,
  mergeCategories,
  type CustomCategory,
  type DisplayCategory
} from "../src/lib/categories.ts";

test("mergeCategories appends custom categories with their uploaded image", () => {
  const customCategories: CustomCategory[] = [
    {
      id: "custom-1",
      name: "Turbo Charger",
      slug: "turbo-charger",
      imageUrl: "https://media.example.com/uploads/turbo.webp",
      imageKey: "uploads/turbo.webp",
      createdAt: "2026-05-08T00:00:00.000Z"
    }
  ];

  const categories = mergeCategories(customCategories);
  const custom = categories.find((category) => category.slug === "turbo-charger");

  assert.equal(categories.length, EQUIPMENT_CATEGORIES.length + 1);
  assert.equal(custom?.value, "Turbo Charger");
  assert.equal(custom?.imageUrl, "https://media.example.com/uploads/turbo.webp");
  assert.equal(custom?.imageKey, "uploads/turbo.webp");
  assert.equal(custom?.isDefault, false);
});

test("mergeCategories keeps default categories first and uses default images", () => {
  const categories = mergeCategories([]);
  const firstDefault = categories[0];

  assert.equal(firstDefault.slug, EQUIPMENT_CATEGORIES[0].slug);
  assert.equal(firstDefault.value, EQUIPMENT_CATEGORIES[0].value);
  assert.match(firstDefault.imageUrl, /^\/images\//);
  assert.equal(firstDefault.isDefault, true);
});

test("findCategoryBySlug resolves custom categories from the merged list", () => {
  const categories = mergeCategories([
    {
      id: "custom-2",
      name: "Bow Thruster",
      slug: "bow-thruster",
      imageUrl: "",
      imageKey: "",
      createdAt: "2026-05-08T00:00:00.000Z"
    }
  ]);

  const found = findCategoryBySlug(categories, "bow-thruster");

  assert.equal(found?.value, "Bow Thruster");
  assert.equal(found?.imageUrl, DEFAULT_CATEGORY_IMAGE);
});

test("getCategorySlug can resolve a custom category name", () => {
  const categories = mergeCategories([
    {
      id: "custom-3",
      name: "Oil Purifier",
      slug: "oil-purifier",
      imageUrl: "",
      imageKey: "",
      createdAt: "2026-05-08T00:00:00.000Z"
    }
  ]);

  assert.equal(getCategorySlug("Oil Purifier", categories), "oil-purifier");
});

test("isReservedCategorySlug detects default category slugs", () => {
  assert.equal(isReservedCategorySlug("marine-gearbox"), true);
  assert.equal(isReservedCategorySlug("custom-marine-gearbox"), false);
});

// ── Subcategory Tests ──────────────────────────────────────────────

test("CustomCategory type includes parentId field", () => {
  const sub: CustomCategory = {
    id: "sub-1",
    name: "Engine Parts",
    slug: "engine-parts",
    imageUrl: "",
    imageKey: "",
    parentId: "parent-1",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  assert.equal(sub.parentId, "parent-1");
});

test("CustomCategory type accepts empty parentId for top-level categories", () => {
  const top: CustomCategory = {
    id: "top-1",
    name: "Spare Parts",
    slug: "spare-parts",
    imageUrl: "",
    imageKey: "",
    parentId: "",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  assert.equal(top.parentId, "");
});

test("DisplayCategory type includes optional parentId field", () => {
  const sub: DisplayCategory = {
    id: "sub-1",
    value: "Engine Parts",
    slug: "engine-parts",
    imageUrl: "",
    imageKey: "",
    parentId: "parent-1",
    isDefault: false
  };

  assert.equal(sub.parentId, "parent-1");

  const withoutParent: DisplayCategory = {
    value: "Marine Gearbox",
    slug: "marine-gearbox",
    imageUrl: "/images/marine-gearbox.jpg",
    imageKey: "",
    isDefault: true
  };

  assert.equal(withoutParent.parentId, undefined);
});

test("mergeCategories passes parentId through for subcategories", () => {
  const parent: CustomCategory = {
    id: "marine-accessories-id",
    name: "Marine Accessories",
    slug: "marine-accessories",
    imageUrl: "/images/marine-accessories.jpg",
    imageKey: "uploads/marine-accessories.jpg",
    parentId: "",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  const subcategory: CustomCategory = {
    id: "engine-parts-id",
    name: "Engine Parts",
    slug: "engine-parts",
    imageUrl: "/images/engine-parts.jpg",
    imageKey: "uploads/engine-parts.jpg",
    parentId: "marine-accessories-id",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  const categories = mergeCategories([parent, subcategory]);

  const parentCat = categories.find((c) => c.slug === "marine-accessories");
  const subCat = categories.find((c) => c.slug === "engine-parts");

  assert.equal(parentCat?.parentId, "");
  assert.equal(subCat?.parentId, "marine-accessories-id");
});

test("mergeCategories handles multiple subcategories under same parent", () => {
  const parent: CustomCategory = {
    id: "spare-parts-id",
    name: "Spare Parts",
    slug: "spare-parts",
    imageUrl: "",
    imageKey: "",
    parentId: "",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  const subs: CustomCategory[] = [
    {
      id: "engine-parts-id",
      name: "Engine Parts",
      slug: "engine-parts",
      imageUrl: "",
      imageKey: "",
      parentId: "spare-parts-id",
      createdAt: "2026-05-17T00:00:00.000Z"
    },
    {
      id: "gearbox-parts-id",
      name: "Gearbox Parts",
      slug: "gearbox-parts",
      imageUrl: "",
      imageKey: "",
      parentId: "spare-parts-id",
      createdAt: "2026-05-17T00:00:00.000Z"
    }
  ];

  const categories = mergeCategories([parent, ...subs]);

  const subCats = categories.filter((c) => c.parentId === "spare-parts-id");
  assert.equal(subCats.length, 2);
  assert.equal(subCats[0].value, "Engine Parts");
  assert.equal(subCats[1].value, "Gearbox Parts");
});

test("mergeCategories subcategories use default image when imageUrl is empty", () => {
  const subcategory: CustomCategory = {
    id: "engine-parts-id",
    name: "Engine Parts",
    slug: "engine-parts",
    imageUrl: "",
    imageKey: "",
    parentId: "parent-id",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  const categories = mergeCategories([subcategory]);
  const sub = categories.find((c) => c.slug === "engine-parts");

  assert.equal(sub?.imageUrl, DEFAULT_CATEGORY_IMAGE);
});

test("mergeCategories subcategories preserve custom imageUrl", () => {
  const subcategory: CustomCategory = {
    id: "engine-parts-id",
    name: "Engine Parts",
    slug: "engine-parts",
    imageUrl: "https://media.example.com/engine-parts.webp",
    imageKey: "uploads/engine-parts.webp",
    parentId: "parent-id",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  const categories = mergeCategories([subcategory]);
  const sub = categories.find((c) => c.slug === "engine-parts");

  assert.equal(sub?.imageUrl, "https://media.example.com/engine-parts.webp");
});

test("mergeCategories total count includes defaults + parents + subcategories", () => {
  const parent: CustomCategory = {
    id: "parent-1",
    name: "Marine Accessories",
    slug: "marine-accessories",
    imageUrl: "",
    imageKey: "",
    parentId: "",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  const sub1: CustomCategory = {
    id: "sub-1",
    name: "Engine Parts",
    slug: "engine-parts",
    imageUrl: "",
    imageKey: "",
    parentId: "parent-1",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  const sub2: CustomCategory = {
    id: "sub-2",
    name: "Gearbox Parts",
    slug: "gearbox-parts",
    imageUrl: "",
    imageKey: "",
    parentId: "parent-1",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  const categories = mergeCategories([parent, sub1, sub2]);

  assert.equal(categories.length, EQUIPMENT_CATEGORIES.length + 3);
});

test("findCategoryBySlug resolves subcategories from merged list", () => {
  const subcategory: CustomCategory = {
    id: "engine-parts-id",
    name: "Engine Parts",
    slug: "engine-parts",
    imageUrl: "/images/engine-parts.jpg",
    imageKey: "",
    parentId: "parent-id",
    createdAt: "2026-05-17T00:00:00.000Z"
  };

  const categories = mergeCategories([subcategory]);
  const found = findCategoryBySlug(categories, "engine-parts");

  assert.equal(found?.value, "Engine Parts");
  assert.equal(found?.parentId, "parent-id");
});

test("findCategoryBySlug returns null for non-existent slug", () => {
  const categories = mergeCategories([]);
  const found = findCategoryBySlug(categories, "non-existent");

  assert.equal(found, null);
});
