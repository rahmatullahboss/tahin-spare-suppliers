import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync(new URL("../src/layouts/AdminLayout.astro", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/admin/AdminSidebar.astro", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/pages/admin/index.astro", import.meta.url), "utf8");
const contentEditor = readFileSync(new URL("../src/components/admin/ContentEditor.astro", import.meta.url), "utf8");
const tiptap = readFileSync(new URL("../src/components/TiptapEditor.astro", import.meta.url), "utf8");
const imageUploader = readFileSync(new URL("../src/components/admin/ImageUploader.astro", import.meta.url), "utf8");
const categoriesPage = readFileSync(new URL("../src/pages/admin/categories.astro", import.meta.url), "utf8");

test("admin shell provides an accessible mobile drawer instead of horizontal navigation", () => {
  assert.match(layout, /data-admin-menu-toggle/);
  assert.match(layout, /aria-expanded="false"/);
  assert.match(layout, /data-admin-drawer-backdrop/);
  assert.match(sidebar, /data-admin-drawer/);
  assert.match(sidebar, /data-admin-menu-close/);
  assert.doesNotMatch(sidebar, /\.sidebar-nav\s*\{[^}]*overflow-x:\s*auto/s);
});

test("dashboard has explicit phone layout rules", () => {
  assert.match(dashboard, /@media \(max-width: 600px\)/);
  assert.match(dashboard, /\.quick-actions\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(dashboard, /\.dashboard-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test("content editor becomes a card-style mobile list without horizontal table scrolling", () => {
  assert.match(contentEditor, /@media \(max-width: 600px\)/);
  assert.match(contentEditor, /\.admin-main \.editor-form\s*\{[^}]*order:\s*-1/s);
  assert.match(contentEditor, /\.admin-main \.items-table[^\{]*\{[^}]*display:\s*block/s);
  assert.match(contentEditor, /\.admin-main \.item-row\s*\{[^}]*display:\s*grid/s);
  assert.match(contentEditor, /\.admin-main \.items-container\s*\{[^}]*overflow-x:\s*visible/s);
});

test("content editor uses mobile-safe controls and contained rich media", () => {
  assert.match(contentEditor, /font-size:\s*16px/);
  assert.match(contentEditor, /min-height:\s*44px/);
  assert.match(tiptap, /\.tiptap-wrapper\s*\{[^}]*min-width:\s*0/s);
  assert.match(tiptap, /@media \(max-width: 600px\)[\s\S]*\.tiptap-content\s*\{[^}]*font-size:\s*16px/s);
  assert.match(imageUploader, /@media \(max-width: 600px\)[\s\S]*\.remove-btn\s*\{[^}]*min-height:\s*44px/s);
});

test("categories use mobile card actions and reduced nested indentation", () => {
  assert.match(categoriesPage, /@media \(max-width: 640px\)/);
  assert.match(categoriesPage, /\.cat-actions\s*\{[^}]*grid-template-columns:\s*1fr 1fr/s);
  assert.match(categoriesPage, /\.subcategory-list\s*\{[^}]*margin-left:\s*0/s);
  assert.match(categoriesPage, /min-height:\s*44px/);
});
