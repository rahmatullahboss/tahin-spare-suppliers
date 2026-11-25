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
import { markInboundMessagesRead, readInboundCounts } from "../src/lib/server/inbound-read-state.ts";
import { eligibleFollowupQuery, readFollowupPage } from "../src/lib/server/email-followup-query.ts";
import { readRelatedProductSummaries } from "../src/lib/server/related-product-data.ts";
import { selectRelatedProductRows } from "../src/lib/server/related-product-rows.ts";
import { mapProductSummary } from "../src/lib/server/product-summary.ts";
import { withPostgresReader } from "../src/lib/server/pg-adapter.ts";

// The hot entrypoint must not eagerly import the Astro application runtime.
const builtEntry = await readFile(new URL("../dist/server/entry.mjs", import.meta.url), "utf8");
assert.ok(builtEntry.length < 10000, "Worker entrypoint unexpectedly contains the Astro runtime");
assert.match(builtEntry, /await import\(["\x27]\.\/chunks\/handler_[^"\x27]+\.mjs["\x27]\)/);
console.log("PASS compiled lazy Astro runtime boundary");

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
  await db.query("INSERT INTO page_overrides(page_key,overrides_json) VALUES('/products',$1::jsonb),('/products/qa-target',$2::jsonb)",[JSON.stringify({"#main-content>section:nth-of-type(1)>div:nth-of-type(1)>h1:nth-of-type(1)":{type:"text",text:"QA existing override"}}),JSON.stringify({"#main-content>section:nth-of-type(1)>h1:nth-of-type(1)":{type:"text",text:"QA detail override"}})]);
  await db.query("INSERT INTO page_overrides(page_key,overrides_json) VALUES('/category/spare-parts',$1::jsonb),('/category/qa-custom/qa-child',$2::jsonb)",[JSON.stringify({"h1":{type:"text",text:"QA category CMS override"}}),JSON.stringify({"h1":{type:"text",text:"QA subcategory CMS override"}})]);
  await db.query("INSERT INTO categories(id,name,slug) VALUES('qa-custom','QA Custom Category','qa-custom')");
  await db.query("INSERT INTO category_presentations(category_slug,label,sort_order) VALUES('qa-custom','QA Custom Display',0)");
  await db.query("INSERT INTO categories(id,name,slug,parent_id) VALUES('qa-child','QA Child','qa-child','qa-custom')");
  await db.query("INSERT INTO products(id,slug,name,brand,category,subcategory) VALUES('qa-child-item','qa-child-item','QA Child Item','Caterpillar','QA Custom Category','QA Child')");
  await db.query("INSERT INTO product_category_assignments(product_id,category_name,subcategory_name) VALUES('qa-manual','QA Custom Category','QA Child')");
  await db.query("INSERT INTO products(id,slug,name,brand,category,subcategory,updated_at) SELECT 'qa-child-page-' || i, 'qa-child-page-' || i, 'QA Child ' || i, CASE WHEN i=25 THEN 'QA Last Brand' ELSE 'Yanmar' END, 'QA Custom Category', 'QA Child', TIMESTAMPTZ '2026-01-01' - i * INTERVAL '1 day' FROM generate_series(1,25) AS i");
  for (const state of ["pending", "processing", "failed", "forwarded"]) {
    await db.query("INSERT INTO inbound_emails(id,from_address,to_address,subject,resend_email_id,forward_status) VALUES($1,'fixture@example.invalid','fixture@example.invalid','QA',$1,$2)", [`qa-replay-${state}`, state]);
  }
  await db.query("UPDATE inbound_emails SET forwarded_at=NOW() WHERE id='qa-replay-forwarded'");
  await db.query("INSERT INTO inbound_emails(id,from_address,to_address,subject,resend_email_id) VALUES('qa-replay-legacy-forwarded','fixture@example.invalid','fixture@example.invalid','QA','qa-replay-legacy-forwarded')");
  const replayReader = { query: async (sql, params) => (await db.query(sql, params)).rows };
  for (const state of ["pending", "processing", "failed", "forwarded", "legacy-forwarded", "missing"]) {
    assert.equal(await isCompletedInboundReplay(replayReader, `qa-replay-${state}`), state === "forwarded");
  }
  console.log("PASS real PostgreSQL completed-inbound replay state isolation including legacy rows");
  assert.equal(Number((await readInboundCounts(replayReader)).unreadCount),5);
  assert.equal(await markInboundMessagesRead(replayReader, ["qa-replay-pending","qa-replay-processing","qa-replay-pending"]),2);
  assert.equal(await markInboundMessagesRead(replayReader, ["qa-replay-pending","qa-replay-processing"]),0);
  assert.equal(await markInboundMessagesRead(replayReader, []),0);
  const counts = await readInboundCounts(replayReader);
  assert.equal(Number(counts.total),5);
  assert.equal(Number(counts.unreadCount),3);
  const unaffected = await db.query("SELECT is_read FROM inbound_emails WHERE id='qa-replay-failed'");
  assert.equal(unaffected.rows[0].is_read,false);
  console.log("PASS real PostgreSQL batched email read marking, replay and unaffected messages");
  await db.query("INSERT INTO sent_emails(id,to_address,subject,body,resend_id,created_at,message_id) SELECT 'qa-followup-' || i, 'qa-' || i || '@example.invalid','QA quotation','fixture','qa-resend-' || i,NOW()-INTERVAL '10 days','<qa-' || i || '@example.invalid>' FROM generate_series(1,109) AS i");
  await db.query("UPDATE sent_emails SET delivery_status='failed' WHERE id='qa-followup-106'");
  await db.query("UPDATE sent_emails SET created_at=NOW() WHERE id='qa-followup-107'");
  await db.query("INSERT INTO inbound_emails(id,from_address,to_address,subject,created_at,in_reply_to_message_id) VALUES('qa-followup-reply','qa-108@example.invalid','fixture@example.invalid','Different subject',NOW(),'<qa-108@example.invalid>')");
  await db.query("INSERT INTO email_followup_drafts(id,source_sent_id,recipient,subject,body) VALUES('qa-draft-109','qa-followup-109','qa-109@example.invalid','Re: QA quotation','fixture')");
  const oldCount = Number((await db.query(eligibleFollowupQuery(false,false,true))).rows[0].total);
  assert.equal(oldCount,105);
  for (const page of [1,2,3]) {
    const oldRows = (await db.query(eligibleFollowupQuery(),[(page-1)*100])).rows;
    const newPage = await readFollowupPage(replayReader,page);
    assert.equal(newPage.candidateCount,oldCount);
    assert.deepEqual(newPage.candidates,oldRows);
  }
  const selected = (await db.query(eligibleFollowupQuery(false,false,false,"selected"),[["qa-followup-1","qa-followup-2","qa-followup-106","qa-followup-107","qa-followup-108","qa-followup-109"]])).rows;
  assert.deepEqual(selected.map(row=>row.id).sort(),["qa-followup-1","qa-followup-2"]);
  console.log("PASS real PostgreSQL follow-up count/page parity, empty page, selected eligibility and reply/draft guards");
  await db.query("INSERT INTO inbound_emails(id,from_address,to_address,subject,body,created_at) VALUES ('qa-thread-in','Fixture <thread@example.invalid>','local@example.invalid','QA Conversation','QA inbound body',NOW()-INTERVAL '2 days'),('qa-thread-in2','thread@example.invalid','local@example.invalid','Re: QA Conversation','QA second inbound',NOW()-INTERVAL '1 day'),('qa-thread-other','other@example.invalid','local@example.invalid','QA Conversation','QA excluded body',NOW())");
  await db.query("INSERT INTO sent_emails(id,to_address,subject,body,in_reply_to_inbound_id,created_at) VALUES('qa-thread-sent','thread@example.invalid','Re: QA Conversation','<p>QA sent body</p>','qa-thread-in',NOW())");
  // Isolated large-catalogue benchmark in a rolled-back transaction.
  await db.query("BEGIN");
  try {
    await db.query("INSERT INTO products(id,slug,name,brand,category,short_description,updated_at) SELECT 'qa-related-' || i,'qa-related-' || i,'QA related ' || i,CASE WHEN i%10=0 THEN 'CAT' ELSE 'Other' END,'QA benchmark',repeat('x',2048),TIMESTAMPTZ '2026-11-01' - i * INTERVAL '1 minute' FROM generate_series(1,900) AS i");
    const identities=[{id:"qa-target",brand:"Caterpillar",category:"Spare Parts",relatedProducts:["qa-manual"]},{id:"qa-none",brand:"Caterpillar",category:"QA benchmark",relatedProducts:["qa-related-1"]},{id:"qa-none",category:"QA benchmark",relatedProducts:["qa-related-1"]},{id:"qa-none",brand:"Nonexistent",category:"QA benchmark"}];
    let beforeBytes=0,afterBytes=0;
    for(const identity of identities){
      const params=[identity.id,identity.relatedProducts??[],Boolean(identity.brand),identity.category??""];
      const previous=await replayReader.query(`SELECT recent.* FROM (
        SELECT id,slug,name,short_description,image_url,updated_at,category,subcategory,brand,model_number,part_number,image_alt
        FROM products ORDER BY updated_at DESC LIMIT 1000
      ) recent WHERE recent.id <> $1 AND (recent.slug=ANY($2::text[]) OR ($3::boolean AND COALESCE(NULLIF(recent.category,''),'Uncategorized')=$4))
      ORDER BY recent.updated_at DESC`,params);
      const reader={query:async(text,params)=>{const rows=await replayReader.query(text,params);afterBytes+=Buffer.byteLength(JSON.stringify(rows));return rows}};
      const actual=await readRelatedProductSummaries(reader,identity);
      assert.deepEqual(actual,selectRelatedProductRows(previous,identity).map(mapProductSummary));
      beforeBytes+=Buffer.byteLength(JSON.stringify(previous));
    }
    assert.ok(afterBytes<beforeBytes);
    console.log(JSON.stringify({relatedProductParity:"PASS",previousSerializedRowsBytes:beforeBytes,optimizedSerializedRowsBytes:afterBytes}));
  } finally { await db.query("ROLLBACK"); }
  await db.query("INSERT INTO blog_posts(id,slug,title,excerpt,content,deleted_at) VALUES ('qa-blog-live','qa-blog-live','QA article title','QA article excerpt',repeat('QA article body ',1000),NULL),('qa-blog-trash','qa-blog-trash','QA excluded article','QA excluded excerpt','fixture',NOW())");
  await db.query("INSERT INTO parts(id,slug,name,short_description,content) VALUES('qa-part-live','qa-part-live','QA part title','QA part excerpt',repeat('QA part body ',1000))");
  await db.query("INSERT INTO page_overrides(page_key,overrides_json) VALUES('/blog',$1::jsonb),('/parts',$2::jsonb)",[JSON.stringify({"h1":{type:"text",text:"QA blog CMS"}}),JSON.stringify({"h1":{type:"text",text:"QA parts CMS"}})]);
  await db.query("INSERT INTO page_overrides(page_key,overrides_json) VALUES('/enquiry',$1::jsonb),('/about',$2::jsonb)",[JSON.stringify({"h1":{type:"text",text:"QA enquiry CMS"}}),JSON.stringify({"h1":{type:"text",text:"QA about CMS"}})]);
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

// Force the first app render to validate mismatched metadata against native PG.
const schemaFixture = new pg.Client({connectionString:uri});
await schemaFixture.connect();
const originalSchemaVersion = (await schemaFixture.query("SELECT version FROM app_schema_meta WHERE key='main'")).rows[0].version;
await schemaFixture.query("UPDATE app_schema_meta SET version='qa-intentionally-mismatched' WHERE key='main'");
await schemaFixture.end();

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
    try { const response=await fetch(base+"/robots.txt",{signal:AbortSignal.timeout(1500),redirect:"manual"}); if(response.ok){await response.text();ready=true;break} } catch {}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,"Worker did not become ready");
  const mismatched=await fetch(base+"/",{headers:{"Cache-Control":"no-cache"},redirect:"manual"});
  assert.equal(mismatched.status,500,"Cold schema mismatch must reject the app render");
  await mismatched.text();
  const restoreSchema=new pg.Client({connectionString:uri});
  await restoreSchema.connect();
  try{
    assert.equal((await restoreSchema.query("SELECT version FROM app_schema_meta WHERE key='main'")).rows[0].version,"qa-intentionally-mismatched");
    await restoreSchema.query("UPDATE app_schema_meta SET version=$1 WHERE key='main'",[originalSchemaVersion]);
  }finally{await restoreSchema.end()}
  const recovered=await fetch(base+"/",{headers:{"Cache-Control":"no-cache"}});
  assert.equal(recovered.status,200);
  assert.ok((await recovered.text()).includes("QA CMS Headline"));
  console.log("PASS cold schema mismatch rejects without migration; restored metadata retries successfully");

  for(const path of ["/","/products","/category/spare-parts","/brands","/sitemap.xml","/api/products?page=1&limit=20","/products/qa-target"]){
    const response=await fetch(base+path,{signal:AbortSignal.timeout(10000),redirect:"manual"});
    assert.equal(response.status,200,path);
    const body=await response.text();
    if(path==="/products/qa-target"){
      assert.ok(body.includes("QA detail override"));
      assert.ok(body.includes("QA Custom Display"));
      assert.ok(body.includes("/category/qa-custom"));
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
  const entryHit = await fetch(base+"/");
  assert.equal(entryHit.status,200);
  assert.equal(entryHit.headers.get("x-tahin-catalogue-cache"),"HIT");
  assert.equal(entryHit.headers.get("x-frame-options"),"DENY");
  assert.equal(entryHit.headers.get("cache-control"),"private, no-store");
  await entryHit.text();
  const bypass = await fetch(base+"/",{headers:{"Cache-Control":"no-cache"}});
  assert.equal(bypass.status,200);
  assert.equal(bypass.headers.get("x-tahin-catalogue-cache"),null);
  await bypass.text();
  const cookieBypass = await fetch(base+"/",{headers:{Cookie:"tahin_admin_session=synthetic-invalid"}});
  assert.equal(cookieBypass.status,200);
  assert.equal(cookieBypass.headers.get("x-tahin-catalogue-cache"),null);
  await cookieBypass.text();
  console.log("PASS entry cache HIT security headers, no-cache and session cookie bypass");
  const heroSection = await fetch(base+"/api/page-content/home/hero");
  assert.equal(heroSection.status,200);
  const heroJson = await heroSection.json();
  assert.equal(heroJson.content.headlineAccent,"QA CMS Headline");
  assert.ok(heroJson.content.slides.length>0);
  const missingSection = await fetch(base+"/api/page-content/home/unknown");
  assert.equal(missingSection.status,404);
  console.log("PASS individual homepage section API with persisted value and defaults");
  const brandPage = await fetch(base+"/brands/caterpillar");
  assert.equal(brandPage.status,200);
  const brandHtml = await brandPage.text();
  const brandCards = [...brandHtml.matchAll(/href="\/products\/([^"]+)" class="product-card"/g)].map(match=>match[1]);
  assert.deepEqual(brandCards.sort(),["qa-alias","qa-child-item","qa-extra","qa-second","qa-target"]);
  assert.ok(brandHtml.includes("caterpillar-logo2.svg"));
  const inventoryPage = await fetch(base+"/inventory/caterpillar-spare-parts");
  assert.equal(inventoryPage.status,200);
  const inventoryCards = [...(await inventoryPage.text()).matchAll(/href="\/products\/([^"]+)" class="product-card"/g)].map(match=>match[1]);
  assert.deepEqual(inventoryCards.sort(),["qa-alias","qa-extra","qa-second","qa-target"]);
  assert.ok(!brandHtml.includes("const saved = overrides"));
  assert.ok(!brandHtml.includes("Edit this page"));
  assert.equal((await fetch(base+"/brands/nonexistent")).status,404);
  const aliasResponse = await fetch(base+"/brands/cat",{redirect:"manual"});
  assert.equal(aliasResponse.status,301);
  assert.ok(aliasResponse.headers.get("location").endsWith("/brands/caterpillar"));
  const overriddenPage = await fetch(base+"/products");
  assert.ok((await overriddenPage.text()).includes("QA existing override"));
  console.log("PASS brand aliases, exact selected cards, managed logo, missing brand, anonymous editor omission and saved override");
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
  assert.ok(pages.every(body=>body.includes("QA category CMS override")));
  assert.ok(pages[1].includes('rel="canonical" href="https://tahinspare.com/category/spare-parts?page=2"'));
  assert.ok(pages[0].includes('/products/qa-page-30'), "full maker/model directory is retained");
  console.log("PASS crawlable category pagination, 35 products across 3 distinct pages");
  const parentResponse = await fetch(base+"/category/qa-custom");
  assert.equal(parentResponse.status,200);
  const parentBody = await parentResponse.text();
  assert.ok(parentBody.includes("/category/qa-custom/qa-child"));
  const childResponse = await fetch(base+"/category/qa-custom/qa-child");
  assert.equal(childResponse.status,200);
  const childBody = await childResponse.text();
  const childCards = [...childBody.matchAll(/href="\/products\/([^"]+)" class="product-card"/g)].map(match => match[1]);
  const childPage2 = await fetch(base+"/category/qa-custom/qa-child?page=2");
  const childPage3 = await fetch(base+"/category/qa-custom/qa-child?page=3");
  assert.equal(childPage2.status,200);
  assert.equal(childPage3.status,200);
  const childBody2 = await childPage2.text();
  const childBody3 = await childPage3.text();
  const childPages = [childCards, ...[childBody2,childBody3].map(body => [...body.matchAll(/href="\/products\/([^"]+)" class="product-card"/g)].map(match=>match[1]))];
  assert.deepEqual(childPages.map(cards=>cards.length),[12,12,3]);
  assert.equal(new Set(childPages.flat()).size,27);
  assert.ok(childPages.flat().includes("qa-child-item"));
  assert.ok(childPages.flat().includes("qa-manual"));
  assert.ok(childBody.includes("QA Last Brand"));
  assert.ok(childBody2.includes("QA subcategory CMS override"));
  assert.ok(childBody2.includes('rel="canonical" href="https://tahinspare.com/category/qa-custom/qa-child?page=2"'));
  assert.equal((await fetch(base+"/category/qa-custom/qa-child?page=4")).status,404);
  const repeatedChildPage2 = await fetch(base+"/category/qa-custom/qa-child?page=2");
  assert.equal(repeatedChildPage2.headers.get("x-tahin-catalogue-cache"),"HIT");
  assert.equal(await repeatedChildPage2.text(),childBody2);
  console.log("PASS subcategory server pagination, full brand links, canonical and isolated page cache");
  assert.equal((await fetch(base+"/category/qa-custom/nonexistent")).status,404);
  console.log("PASS custom parent/child, primary and additional category assignments, and missing subcategory");
  for(const [route,title,excerpt,override,hiddenBody] of [
    ["/blog","QA article title","QA article excerpt","QA blog CMS","QA article body "],
    ["/parts","QA part title","QA part excerpt","QA parts CMS","QA part body "]
  ]){
    const response=await fetch(base+route);
    assert.equal(response.status,200,route);
    const body=await response.text();
    for(const expected of [title,excerpt,override]) assert.ok(body.includes(expected),expected);
    assert.ok(!body.includes(hiddenBody));
    assert.ok(!body.includes("QA excluded article"));
    assert.ok(body.includes("/category/qa-custom"));
  }
  console.log("PASS narrow blog and parts cards, deleted article exclusion and CMS/footer preservation");
  for(const [route,override,prefill] of [
    ["/enquiry","QA enquiry CMS",""],
    ["/enquiry?product=QA%20Engine","QA enquiry CMS","I am interested in QA Engine."],
    ["/enquiry?brand=QA%20Maker","QA enquiry CMS","I am looking for QA Maker"],
    ["/about","QA about CMS",""]
  ]){
    const response=await fetch(base+route);
    assert.equal(response.status,200,route);
    const body=await response.text();
    assert.ok(body.includes(override),route);
    assert.ok(body.includes("QA Custom Display"),route);
    if(prefill){
      assert.ok(body.includes(prefill),route);
      assert.equal(response.headers.get("x-tahin-catalogue-cache"),null);
    }else if(route==="/enquiry"){
      assert.ok(!body.includes("I am interested in QA Engine."));
      assert.ok(!body.includes("I am looking for QA Maker"));
    }
  }
  console.log("PASS enquiry and about CMS/category preservation and uncached distinct prefills");
  const admin=await fetch(base+"/admin",{redirect:"manual"});
  assert.ok([301,302,303,307,308].includes(admin.status),"unauthenticated admin must redirect");
  console.log("PASS local unauthenticated admin redirect");
  const login=await fetch(base+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:"local-fixture-only"})});
  assert.equal(login.status,200);
  const cookie=login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  await login.text();
  for(const route of ["/admin/emails/thread/inbound/qa-thread-in","/admin/emails/thread/sent/qa-thread-sent"]){
    const response=await fetch(base+route,{headers:{Cookie:cookie},redirect:"manual"});
    assert.equal(response.status,200,route);
    const body=await response.text();
    for(const expected of ["QA inbound body","QA second inbound","QA sent body","3 messages"]) assert.ok(body.includes(expected),expected);
    assert.ok(!body.includes("QA excluded body"));
  }
  const readback=new pg.Client({connectionString:uri});
  await readback.connect();
  try{
    const result=await readback.query("SELECT id,is_read FROM inbound_emails WHERE id LIKE 'qa-thread-%' ORDER BY id");
    assert.deepEqual(result.rows.map(row=>[row.id,row.is_read]),[["qa-thread-in",true],["qa-thread-in2",true],["qa-thread-other",false]]);
  }finally{await readback.end()}
  console.log("PASS authenticated local email conversation, isolation and read-state replay");

  if (process.env.TAHIN_CPU_PROFILE === "1") await profileLocalWorker(inspectorPort, base, ["/", "/category/spare-parts", "/products", "/products/qa-target"]);
} catch(error) {
  console.error(logs);
  throw error;
} finally {
  worker.kill("SIGTERM");
  await new Promise(resolve=>{if(worker.exitCode!==null)resolve();else{worker.once("exit",resolve);setTimeout(resolve,2500).unref()}});
  await rm(persistence,{recursive:true,force:true});
}
