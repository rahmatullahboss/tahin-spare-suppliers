// Read-only, low-volume public route sampling with Wrangler tail.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

const marker = randomUUID();
const expectedVersion = process.env.TAHIN_EXPECTED_WORKER_VERSION;
const versions = new Set();
const uncached = process.argv.includes("--uncached");
const allRoutes = uncached ? ["/", "/category/spare-parts", "/products"] : ["/", "/products", "/category/spare-parts", "/brands", "/blog", "/sitemap.xml", "/api/products?page=1&limit=20"];
const requestedRoute = process.argv.find(arg => arg.startsWith("--route="))?.slice(8);
if (requestedRoute && !allRoutes.includes(requestedRoute)) throw new Error("Unsupported benchmark route");
const routes = requestedRoute ? [requestedRoute] : allRoutes;
const tail = spawn("node_modules/.bin/wrangler", ["tail", "tahin-spare-suppliers", "--format", "json", "--header", `x-tahin-cpu-audit:${marker}`], {stdio: ["ignore", "pipe", "pipe"]});
let output = "";
let errors = "";
let spawnError;
tail.on("error", error => { spawnError = error; });
tail.stdout.on("data", chunk => { output += chunk; });
tail.stderr.on("data", chunk => { errors += chunk; });
const results = [];
try {
  await sleep(5500);
  if (spawnError || tail.exitCode !== null) throw new Error("Wrangler tail could not start");
  for (const path of routes) {
    for (let pass = 1; pass <= (uncached ? 4 : 2); pass++) {
      const start = performance.now();
      try {
        const response = await fetch("https://tahinspare.com" + path, {headers: {"x-tahin-cpu-audit": marker, ...(uncached ? {"Cache-Control":"no-cache"} : {})}, redirect: "manual", signal: AbortSignal.timeout(12000)});
        const bytes = (await response.arrayBuffer()).byteLength;
        results.push({path, pass, status: response.status, cache: response.headers.get("x-tahin-catalogue-cache"), bytes, wallMs: Math.round(performance.now() - start)});
      } catch (error) {
        results.push({path, pass, error: error.name});
      }
    }
  }
  await sleep(6500);
} finally {
  tail.kill("SIGTERM");
}
console.log(JSON.stringify({requests: results}, null, 2));
let count = 0;
for (const chunk of output.matchAll(/^\{[\s\S]*?^\}/gm)) {
  try {
    const entry = JSON.parse(chunk[0]);
    const url = entry.event?.request?.url;
    if (!url) continue;
    const route = new URL(url);
    if (route.hostname !== "tahinspare.com" || !routes.includes(route.pathname + route.search)) continue;
    const version = entry.scriptVersion?.id ?? "unknown";
    versions.add(version);
    count++;
    console.log(JSON.stringify({version, path: route.pathname + route.search, cpuMs: entry.cpuTime ?? entry.cpuTimeMs ?? entry.event?.cpuTime ?? null, wallMs: entry.wallTime ?? entry.wallTimeMs ?? null, outcome: entry.outcome, status: entry.event?.response?.status, fields: Object.keys(entry)}));
  } catch {}
}
console.log(JSON.stringify({tailEvents: count, tailStderrPresent: Boolean(errors), tailOutputBytes: output.length}));
console.log(JSON.stringify({versions: [...versions], expectedVersion: expectedVersion ?? null}));
if (count !== results.length || results.some(r => r.status !== 200) || versions.size !== 1 || versions.has("unknown") || (expectedVersion && !versions.has(expectedVersion))) process.exitCode = 1;
