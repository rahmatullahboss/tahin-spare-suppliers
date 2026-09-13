import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/ci-deploy.yml", import.meta.url),
  "utf8"
);

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tiptapEditor = readFileSync(new URL("../src/components/TiptapEditor.astro", import.meta.url), "utf8");

test("CI verifies pull requests and master pushes before deployment", () => {
  assert.match(workflow, /pull_request:[\s\S]*?branches:[\s\S]*?- master/);
  assert.match(workflow, /push:[\s\S]*?branches:[\s\S]*?- master/);
  assert.match(workflow, /deploy-readiness:[\s\S]*?needs: verify/);
  assert.match(workflow, /deploy:[\s\S]*?needs:[\s\S]*?- verify[\s\S]*?- deploy-readiness/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/master'/);
});

test("CI blocks deployment behind tests, audit, build, and Wrangler validation", () => {
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm audit --omit=dev/);
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /run: npx wrangler deploy --dry-run/);
});

test("production deployment uses GitHub secrets instead of committed credentials", () => {
  assert.match(workflow, /run: npx wrangler deploy/);
  assert.match(workflow, /run: npm run smoke:production/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.doesNotMatch(workflow, /474078d5f990169d7dadf4e1df83214a/);
});


test("direct Tiptap imports are declared as direct dependencies", () => {
  const imports = [...tiptapEditor.matchAll(/from\s+["'](@tiptap\/[^"']+)["']/g)]
    .map((match) => match[1]);

  for (const dependency of imports) {
    assert.ok(
      packageJson.dependencies?.[dependency],
      `${dependency} must be declared in package.json dependencies`
    );
  }
});
