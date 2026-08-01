import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync(new URL("../src/layouts/AdminLayout.astro", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/admin/AdminSidebar.astro", import.meta.url), "utf8");

test("admin shell provides an accessible mobile drawer instead of horizontal navigation", () => {
  assert.match(layout, /data-admin-menu-toggle/);
  assert.match(layout, /aria-expanded="false"/);
  assert.match(layout, /data-admin-drawer-backdrop/);
  assert.match(sidebar, /data-admin-drawer/);
  assert.match(sidebar, /data-admin-menu-close/);
  assert.doesNotMatch(sidebar, /\.sidebar-nav\s*\{[^}]*overflow-x:\s*auto/s);
});
