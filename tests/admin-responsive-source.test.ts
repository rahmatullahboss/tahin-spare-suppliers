import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync(new URL("../src/layouts/AdminLayout.astro", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/admin/AdminSidebar.astro", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/pages/admin/index.astro", import.meta.url), "utf8");

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
