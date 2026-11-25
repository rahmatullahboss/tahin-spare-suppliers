// Local-only Worker smoke against a disposable, empty PostgreSQL database.
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import pg from "pg";
import { profileLocalWorker } from "./profile-local-worker.mjs";
import { isCompletedInboundReplay } from "../src/lib/server/inbound-replay.ts";
import { withPostgresReader } from "../src/lib/server/pg-adapter.ts";

const uri = process.env.PG_ADAPTER_TEST_URL;
assert.ok(uri, "Set PG_ADAPTER_TEST_URL to a disposable local fixture database");
const target = new URL(uri);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.pathname, "/tahin_qa");
const db = new pg.Client({ connectionString: uri });
await db.connect();
try {
  const existing = await db.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'");
  assert.equal(existing.rows[0].n, 0, "Fixture requires an empty database; never overwrite an existing snapshot");
  const schema = await readFile(new URL("../src/lib/server/schema.sql", import.meta.url), "utf8");
  await db.query(schema);
  let hash = 2166136261;
  for (let i = 0; i < schema.length; i++) {
    hash ^= schema.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const fingerprint = "fnv1a-" + (hash >>> 0).toString(16).padStart(8, "0");
  await db.query("CREATE TABLE app_schema_meta(key TEXT PRIMARY KEY,version TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await db.query("INSERT INTO app_schema_meta(key,version) VALUES('main',$1)", [fingerprint]);
  const fixtures = [
    ["qa-target","Caterpillar","Spare Parts","2026-11-24T01:00:00Z",'["qa-manual"]'],
    ["qa-manual","Other","Marine Pump","2026-11-23T01:00:00Z","[]"],
    ["qa-alias","CAT","Spare Parts","2026-11-22T01:00:00Z","[]"],
    ["qa-second","Caterpiller","Spare Parts","2026-11-21T01:00:00Z","[]"],
    ["qa-extra","Caterpillar","Spare Parts","2026-11-20T01:00:00Z","[]"],
    ["qa-wrong","Yanmar","Spare Parts","2026-11-19T01:00:00Z","[]"],
  ];
  for (const [id,brand,category,updated,related] of fixtures) {
    await db.query("INSERT INTO products(id,slug,name,brand,category,updated_at,related_products) VALUES($1,$1,$1,$2,$3,$4,$5)",[id,brand,category,updated,related]);
  }
  await db.query("INSERT INTO products(id,slug,name,brand,category,updated_at) SELECT 'qa-page-' || i, 'qa-page-' || i, 'QA page ' || i, 'QA Other', 'Spare Parts', TIMESTAMPTZ '2026-01-01' - i * INTERVAL '1 day' FROM generate_series(1,30) AS i");
  await db.query("INSERT INTO brands(id,name,slug) VALUES('qa-brand','Caterpillar','caterpillar')");
  await db.query("INSERT INTO brands(id,name,slug,logo_url) VALUES('qa-brand-custom','QA Brand','qa-brand','/images/qa-custom-brand.webp')");
  await db.query("INSERT INTO page_sections(page_key,section_key,content_json) VALUES('home','hero',$1::jsonb)", [JSON.stringify({headlineAccent:"QA CMS Headline"})]);
  await db.query("INSERT INTO category_presentations(category_slug,label) VALUES('spare-parts','QA Spare Parts')");
  await db.query("INSERT INTO categories(id,name,slug) VALUES('qa-custom','QA Custom Category','qa-custom')");
  await db.query("INSERT INTO category_presentations(category_slug,label,sort_order) VALUES('qa-custom','QA Custom Display',0)");
  for (const state of ["pending", "processing", "failed", "forwarded"]) {
    await db.query("INSERT INTO inbound_emails(id,from_address,to_address,subject,resend_email_id,forward_status) VALUES($1,'fixture@example.invalid','fixture@example.invalid','QA',$1,$2)", [`qa-replay-${state}`, state]);
  }
  const replayReader = { query: async (sql, params) => (await db.query(sql, params)).rows };
  for (const state of ["pending", "processing", "failed", "forwarded", "missing"]) {
    assert.equal(await isCompletedInboundReplay(replayReader, `qa-replay-${state}`), state === "forwarded");
  }
  console.log("PASS real PostgreSQL completed-inbound replay state isolation");
  console.log("PASS real PostgreSQL fixture schema and catalogue");
} finally { await db.end(); }

// Prove connection reuse and teardown using actual backend session identities.
let escapedReader;
const firstPid = await withPostgresReader(uri, {}, async reader => {
  escapedReader = reader;
  const first = (await reader.query("SELECT pg_backend_pid() AS pid"))[0].pid;
  const second = (await reader.query("SELECT pg_backend_pid() AS pid"))[0].pid;
  assert.equal(first, second);
  return first;
});
await assert.rejects(escapedReader.query("SELECT 1"), /scope has ended/);
let failedReader;
await assert.rejects(withPostgresReader(uri, {}, async reader => {
  failedReader = reader;
  await reader.query("SELECT 1");
  throw new Error("synthetic read interruption");
}), /synthetic read interruption/);
await assert.rejects(failedReader.query("SELECT 1"), /scope has ended/);
const pids = await Promise.all([0, 1].map(() => withPostgresReader(uri, {}, async reader =>
  (await reader.query("SELECT pg_backend_pid() AS pid"))[0].pid
)));
assert.notEqual(pids[0], pids[1]);
assert.ok(pids.every(pid => pid !== firstPid));
console.log("PASS PostgreSQL connection reuse, concurrent scope isolation and error cleanup");

const socket = createServer();
await new Promise((resolve, reject) => {socket.once("error", reject);socket.listen(0,"127.0.0.1",resolve)});
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const inspectorSocket = createServer();
await new Promise((resolve, reject) => {inspectorSocket.once("error", reject);inspectorSocket.listen(0,"127.0.0.1",resolve)});
const inspectorPort = inspectorSocket.address().port;
await new Promise(resolve => inspectorSocket.close(resolve));
const persistence = await mkdtemp(join(tmpdir(),"tahin-local-qa-"));
const worker = spawn("node_modules/.bin/wrangler",[
  "dev","--local","--ip","127.0.0.1","--host","127.0.0.1","--port",String(port),"--persist-to",persistence,
  "--inspector-ip","127.0.0.1","--inspector-port",String(inspectorPort),
  "--show-interactive-dev-session=false","--var","SESSION_SECRET:local-fixture-only",
  "--var","ADMIN_PASSWORD:local-fixture-only","--var","RESEND_API_KEY:local-fixture-only",
],{env:{...process.env,CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_SUPABASE_HYPERDRIVE:uri},stdio:["ignore","pipe","pipe"]});
let logs = "";
worker.stdout.on("data",d=>{logs=(logs+d).slice(-8000)});
worker.stderr.on("data",d=>{logs=(logs+d).slice(-8000)});
const base="http://127.0.0.1:"+port;
try {
  let ready=false;
  for(let i=0;i<40;i++){
    if(worker.exitCode!==null) break;
    try { const response=await fetch(base+"/",{signal:AbortSignal.timeout(1500),redirect:"manual"}); if(response.ok){await response.text();ready=true;break} } catch {}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,"Worker did not become ready");
  for(const path of ["/","/products","/category/spare-parts","/brands","/sitemap.xml","/api/products?page=1&limit=20","/products/qa-target"]){
    const response=await fetch(base+path,{signal:AbortSignal.timeout(10000),redirect:"manual"});
    assert.equal(response.status,200,path);
    const body=await response.text();
    if(path==="/products/qa-target"){
      for(const slug of ["qa-manual","qa-alias","qa-second"]) assert.ok(body.includes("/products/"+slug),slug);
      for(const slug of ["qa-extra","qa-wrong"]) assert.ok(!body.includes("/products/"+slug),slug);
    }
    if(path==="/") {
      assert.ok(body.includes("QA Spare Parts"));
      assert.ok(body.includes("QA Custom Display"));
      assert.ok(body.includes("QA CMS Headline"));
      assert.ok(body.includes("/images/qa-custom-brand.webp"));
      assert.ok(body.includes("caterpillar-logo2.svg"));
      assert.ok(body.includes("/category/qa-custom"));
    }
    console.log("PASS local Worker",path,response.headers.get("x-tahin-catalogue-cache")??"cache unreported");
  }
  const page1 = await fetch(base+"/category/spare-parts");
  const page2 = await fetch(base+"/category/spare-parts?page=2");
  const page3 = await fetch(base+"/category/spare-parts?page=3");
  const invalidPage = await fetch(base+"/category/spare-parts?page=99");
  assert.equal(page1.status, 200);
  assert.equal(page2.status, 200);
  assert.equal(page3.status, 200);
  assert.equal(invalidPage.status, 404);
  const pages = await Promise.all([page1.text(), page2.text(), page3.text()]);
  const cards = pages.map(body => [...body.matchAll(/href="\/products\/([^"]+)" class="product-card"/g)].map(match => match[1]));
  assert.deepEqual(cards.map(items => items.length), [12,12,11]);
  assert.equal(new Set(cards.flat()).size, 35, "all 35 products remain reachable exactly once as cards");
  assert.ok(pages[0].includes('?page=2#category-products'));
  assert.ok(pages[1].includes('rel="canonical" href="https://tahinspare.com/category/spare-parts?page=2"'));
  assert.ok(pages[0].includes('/products/qa-page-30'), "full maker/model directory is retained");
  console.log("PASS crawlable category pagination, 35 products across 3 distinct pages");
  const admin=await fetch(base+"/admin",{redirect:"manual"});
  assert.ok([301,302,303,307,308].includes(admin.status),"unauthenticated admin must redirect");
  console.log("PASS local unauthenticated admin redirect");
  if (process.env.TAHIN_CPU_PROFILE === "1") await profileLocalWorker(inspectorPort, base, ["/", "/category/spare-parts", "/products", "/products/qa-target"]);
} catch(error) {
  console.error(logs);
  throw error;
} finally {
  worker.kill("SIGTERM");
  await new Promise(resolve=>{if(worker.exitCode!==null)resolve();else{worker.once("exit",resolve);setTimeout(resolve,2500).unref()}});
  await rm(persistence,{recursive:true,force:true});
}
