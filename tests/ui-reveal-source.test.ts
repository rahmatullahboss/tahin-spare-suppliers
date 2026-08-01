import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/layouts/MainLayout.astro", import.meta.url), "utf8");

test("reveal classes never depend on JavaScript for content visibility", () => {
  assert.doesNotMatch(css, /\.reveal-ready/);
  assert.doesNotMatch(css, /(?:\.reveal|\.reveal-left|\.reveal-right|\.reveal-scale|\.reveal-stagger\s*>\s*\*)[^}]*opacity:\s*0;/);
  assert.doesNotMatch(layout, /IntersectionObserver/);
  assert.doesNotMatch(layout, /reveal-ready/);
  assert.doesNotMatch(layout, /setTimeout\s*\(/);
});

test("reduced motion remains enabled without special reveal recovery rules", () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /prefers-reduced-motion[\s\S]*animation-duration:\s*0\.01ms\s*!important/);
  assert.doesNotMatch(css, /prefers-reduced-motion[\s\S]*reveal-ready/);
});
