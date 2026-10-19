import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

type Row = Record<string, unknown>;
type SendInput = { to: string; subject: string; html: string; headers?: Record<string, string>; idempotencyKey?: string };
type TestEnv = { db: FakeDb; authorized: boolean; send: (input: SendInput) => Promise<{ id: string; resendId: string }> };

const source: Row = {
  id: "source-001",
  to_address: "fixture@example.net",
  subject: "Marine engine quotation",
  created_at: "2026-10-01T00:00:00Z",
  resend_id: "resend-original",
  message_id: "<original-001@example.net>",
  delivery_status: "delivered",
};

class FakeDb {
  drafts = new Map<string, Row>();
  sent: Row[] = [];
  eligible = true;
  sources: Row[] = [{ ...source }];
  ineligibleIds = new Set<string>();

  async query(sql: string, values: unknown[] = []): Promise<Row[]> {
    if (/UPDATE email_followup_drafts[\s\S]*INTERVAL '15 minutes'/.test(sql)) return [];
    if (sql.includes("COUNT(*) AS total")) return [{ total: this.eligible ? this.sources.length : 0 }];
    if (sql.includes("FROM sent_emails s") && sql.includes("s.delivery_status")) {
      if (!this.eligible) return [];
      const id = sql.includes("s.id = $1") ? String(values[0]) : "";
      return this.sources.filter((s) => (!id || s.id === id) && !this.ineligibleIds.has(String(s.id))).map((s) => ({ ...s }));
    }
    if (sql.includes("FROM email_followup_drafts f JOIN sent_emails s")) {
      return [...this.drafts.values()].filter((d) => ["draft","approved","sending","uncertain"].includes(String(d.status)));
    }
    if (sql.includes("SELECT id, source_sent_id, status FROM email_followup_drafts")) {
      const d = this.drafts.get(String(values[0]));
      return d ? [d] : [];
    }
    if (sql.includes("INSERT INTO email_followup_drafts")) {
      const [id, sourceSentId, recipient, subject, body] = values;
      if ([...this.drafts.values()].some((d) => d.source_sent_id === sourceSentId && ["draft","approved","sending","uncertain"].includes(String(d.status)))) return [];
      const d = { id, source_sent_id:sourceSentId, recipient, subject, body, status: "draft", resend_id: "" };
      this.drafts.set(String(id), d);
      return [d];
    }
    if (sql.includes("SET subject = $2, body = $3")) {
      const d = this.drafts.get(String(values[0]));
      if (!d || !["draft","approved"].includes(String(d.status))) return [];
      const changed = d.subject !== values[1] || d.body !== values[2];
      d.subject = values[1]; d.body = values[2];
      d.status = values[3] === "approved" ? "approved" : changed ? "draft" : d.status;
      return [{ id:d.id, status:d.status }];
    }
    if (sql.includes("SET status = 'sending'")) {
      const d = this.drafts.get(String(values[0]));
      if (!d || d.status !== "approved") return [];
      d.status = "sending";
      return [{ ...d }];
    }
    if (sql.includes("SET status = 'replied'")) {
      const d = this.drafts.get(String(values[0]));
      if (d && ["draft","approved","sending"].includes(String(d.status))) d.status = "replied";
      return [];
    }
    if (sql.includes("SET status = 'cancelled'")) {
      const d = this.drafts.get(String(values[0]));
      if (!d || !["draft","approved"].includes(String(d.status))) return [];
      d.status = "cancelled"; return [{ id:d.id }];
    }
    if (sql.includes("SET resend_id = $2")) {
      const d = this.drafts.get(String(values[0])); if (d) d.resend_id = values[1]; return [];
    }
    if (sql.includes("INSERT INTO sent_emails")) {
      this.sent.push({ id:values[0], recipient:values[1], provider_id:values[5], parent_id:values[6], draft_id:values[7] });
      return [];
    }
    if (sql.includes("SET status = 'sent'")) {
      const d = this.drafts.get(String(values[0])); if (d?.status === "sending") d.status="sent"; return [];
    }
    if (sql.includes("SET status = 'uncertain'")) {
      const d = this.drafts.get(String(values[0])); if(d?.status === "sending"){d.status="uncertain"; d.send_error=values[1];} return [];
    }
    throw new Error(`Unexpected DB query: ${sql.slice(0,110)}`);
  }
}

async function handlers(): Promise<{
  GET: (context: Row) => Promise<Response>;
  PATCH: (context: Row) => Promise<Response>;
  POST: (context: Row) => Promise<Response>;
}> {
  const path = fileURLToPath(new URL("../src/pages/api/admin/emails/followups.ts", import.meta.url));
  const fragments: Record<string, string> = {
    api: "export async function requireAdminRequest(){return globalThis.__fuE2E.authorized ? globalThis.__fuE2E : null}",
    db: "export async function ensureSchema(){}; export function getDb(){return globalThis.__fuE2E.db}",
    "email-service": "export async function sendEmail(_env,input){return globalThis.__fuE2E.send(input)}; export function getResendClient(){return {emails:{get:async()=>({data:{message_id:'<original-001@example.net>'}})}}}",
    "email-content": "export function plainTextEmailToHtml(s){return '<p>'+s.replace(/\\n/g,'<br>')+'</p>'}",
    "email-signature": "export async function getEmailSignatureSettings(){return {}}; export function renderEmailSignatureHtml(){return ''}; export function appendEmailSignature(html){return html}",
  };
  const bundle = await build({
    entryPoints: [path], bundle: true, format: "esm", platform: "neutral", write: false,
    plugins: [{
      name: "isolated-provider-and-db",
      setup(ctx) {
        ctx.onResolve({ filter: /\/(api|db|email-service|email-content|email-signature)$/ }, (args) => {
          const key = args.path.split("/").at(-1) ?? "";
          return fragments[key] ? { path: key, namespace:"e2e-fake" } : undefined;
        });
        ctx.onLoad({ filter: /.*/, namespace:"e2e-fake" }, (args) => ({contents:fragments[args.path], loader:"js"}));
      }
    }]
  });
  const url = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`;
  return import(url) as Promise<{ GET:(context:Row)=>Promise<Response>; PATCH:(context:Row)=>Promise<Response>; POST:(context:Row)=>Promise<Response> }>;
}

function context(method:string, body?:Row):Row {
  const url=new URL("https://fixture.test/api/admin/emails/followups");
  return { url, request:new Request(url,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined}) };
}
async function json(response:Response):Promise<Row> {
  return await response.json() as Row;
}
function setup():TestEnv {
  const db = new FakeDb();
  const sent: SendInput[] = [];
  const env: TestEnv = {db,authorized:true,send:async (input) => {
    sent.push(input);
    return { id:`stored-${sent.length}`, resendId:`resend-followup-${sent.length}` };
  }};
  (env as TestEnv & { sentInputs: SendInput[] }).sentInputs=sent;
  (globalThis as typeof globalThis & {__fuE2E:TestEnv}).__fuE2E = env;
  return env;
}
function inputs(env:TestEnv):SendInput[] {
  return (env as TestEnv & {sentInputs:SendInput[]}).sentInputs;
}

test("functional follow-up: create, edit, approve, unchanged save, explicit send, retry blocked", async () => {
  const route = await handlers();
  const env = setup();
  const due = await json(await route.GET(context("GET")));
  assert.equal(due.candidateCount, 1);
  const created = await json(await route.POST(context("POST",{action:"create",ids:["source-001"]})));
  assert.equal((created.results as Row[])[0].ok, true);
  const draftId=String([...env.db.drafts.keys()][0]);
  const updated = await json(await route.PATCH(context("PATCH",{action:"save",id:draftId,subject:"Re: Marine engine quotation",body:"Hello, checking back."})));
  assert.equal((updated.draft as Row).status,"draft");
  const approved = await json(await route.PATCH(context("PATCH",{action:"approve",id:draftId,subject:"Re: Marine engine quotation",body:"Hello, checking back."})));
  assert.equal((approved.draft as Row).status,"approved");
  // Saving the same content must never silently remove approval.
  const unchanged = await json(await route.PATCH(context("PATCH",{action:"save",id:draftId,subject:"Re: Marine engine quotation",body:"Hello, checking back."})));
  assert.equal((unchanged.draft as Row).status,"approved");
  assert.equal(inputs(env).length,0);
  const response=await json(await route.POST(context("POST",{action:"send",ids:[draftId]})));
  assert.equal((response.results as Row[])[0].ok,true);
  assert.equal(env.db.drafts.get(draftId)?.status,"sent");
  assert.equal(inputs(env).length,1);
  assert.equal(inputs(env)[0].to,"fixture@example.net");
  assert.equal(inputs(env)[0].headers?.["In-Reply-To"],"<original-001@example.net>");
  assert.equal(inputs(env)[0].idempotencyKey,`followup/${draftId}`);
  assert.equal(env.db.sent.length,1);
  assert.equal(env.db.sent[0].parent_id,"source-001");
  const repeat=await json(await route.POST(context("POST",{action:"send",ids:[draftId]})));
  assert.equal((repeat.results as Row[])[0].ok,false);
  assert.equal(inputs(env).length,1);
});

test("functional follow-up: saving an edited approved message revokes approval", async () => {
  const route=await handlers(); const env=setup();
  await route.POST(context("POST",{action:"create",ids:["source-001"]}));
  const id=[...env.db.drafts.keys()][0];
  await route.PATCH(context("PATCH",{action:"approve",id,subject:"Re: Marine engine quotation",body:"Hello"}));
  const edited=await json(await route.PATCH(context("PATCH",{action:"save",id,subject:"Re: Marine engine quotation",body:"New text"})));
  assert.equal((edited.draft as Row).status,"draft");
  const attempt=await json(await route.POST(context("POST",{action:"send",ids:[id]})));
  assert.equal((attempt.results as Row[])[0].ok,false);
  assert.equal(inputs(env).length,0);
});

test("functional follow-up: reply before send stops delivery", async () => {
  const route=await handlers(); const env=setup();
  await route.POST(context("POST",{action:"create",ids:["source-001"]}));
  const id=[...env.db.drafts.keys()][0];
  await route.PATCH(context("PATCH",{action:"approve",id,subject:"Re: Marine engine quotation",body:"Hello"}));
  env.db.eligible=false;
  const result=await json(await route.POST(context("POST",{action:"send",ids:[id]})));
  assert.equal((result.results as Row[])[0].ok,false);
  assert.equal(env.db.drafts.get(id)?.status,"replied");
  assert.equal(inputs(env).length,0);
});

test("functional follow-up: ambiguous provider failure is uncertain and never auto-retried", async () => {
  const route=await handlers(); const env=setup();
  await route.POST(context("POST",{action:"create",ids:["source-001"]}));
  const id=[...env.db.drafts.keys()][0];
  await route.PATCH(context("PATCH",{action:"approve",id,subject:"Re: Marine engine quotation",body:"Hello"}));
  let calls=0; env.send=async()=>{calls++;throw new Error("Provider timed out after unknown acceptance");};
  const result=await json(await route.POST(context("POST",{action:"send",ids:[id]})));
  assert.equal((result.results as Row[])[0].ok,false);
  assert.equal(env.db.drafts.get(id)?.status,"uncertain");
  await route.POST(context("POST",{action:"send",ids:[id]}));
  assert.equal(calls,1);
});

test("functional follow-up: fifteen different clients send once each; sixteen rejected", async () => {
  const route = await handlers();
  const env = setup();
  env.db.sources = Array.from({ length: 16 }, (_, index) => ({
    ...source,
    id: `source-${index + 1}`,
    to_address: `fixture-${index + 1}@example.net`,
    message_id: `<original-${index + 1}@example.net>`,
  }));
  const sourceIds = env.db.sources.map((item) => String(item.id));
  const created = await json(await route.POST(context("POST",{ action:"create",ids:sourceIds })));
  assert.equal((created.results as Row[]).filter((item) => item.ok).length,16);
  const drafts = [...env.db.drafts.entries()];
  assert.equal(drafts.length,16);
  for (const [id] of drafts) {
    const res = await route.PATCH(context("PATCH",{
      action:"approve",id,subject:"Re: Marine engine quotation",body:"Checking back after seven days."
    }));
    assert.equal(res.status,200);
  }
  assert.equal(inputs(env).length,0);
  const draftIds = drafts.map(([id]) => id);
  const tooMany = await route.POST(context("POST",{action:"send",ids:draftIds}));
  assert.equal(tooMany.status,400);
  assert.equal(inputs(env).length,0);
  const sent = await json(await route.POST(context("POST",{action:"send",ids:draftIds.slice(0,15)})));
  assert.equal((sent.results as Row[]).filter((item) => item.ok).length,15);
  assert.equal(inputs(env).length,15);
  assert.equal(new Set(inputs(env).map((item) => item.to)).size,15);
  assert.equal(new Set(inputs(env).map((item) => item.idempotencyKey)).size,15);
  assert.equal(env.db.sent.length,15);
  assert.equal(env.db.drafts.get(draftIds[15])?.status,"approved");
  const last = await json(await route.POST(context("POST",{action:"send",ids:[draftIds[15]]})));
  assert.equal((last.results as Row[])[0].ok,true);
  assert.equal(inputs(env).length,16);
});

test("functional follow-up: two simultaneous send clicks claim one draft only once", async () => {
  const route=await handlers();const env=setup();
  await route.POST(context("POST",{action:"create",ids:["source-001"]}));
  const id=[...env.db.drafts.keys()][0];
  await route.PATCH(context("PATCH",{action:"approve",id,subject:"Re: Marine engine quotation",body:"Hello"}));
  const responses=await Promise.all([
    route.POST(context("POST",{action:"send",ids:[id]})),
    route.POST(context("POST",{action:"send",ids:[id]}))
  ]);
  const results=await Promise.all(responses.map(json));
  assert.equal(results.flatMap((item)=>item.results as Row[]).filter((item)=>item.ok).length,1);
  assert.equal(inputs(env).length,1);
});

test("SQL and JS subject normalization agree about reply prefixes and repeated whitespace", async () => {
  const { normalizeEmailSubject, normalizedEmailSubjectSql } =
    await import("../src/lib/server/email-thread.ts");
  assert.equal(normalizeEmailSubject("  Re: FWD: Marine  Engine  Quotation "), "marine engine quotation");
  assert.equal(normalizeEmailSubject("Marine Engine Quotation"), "marine engine quotation");
  const sql = normalizedEmailSubjectSql("s.subject");
  assert.match(sql, /regexp_replace\(regexp_replace\(s\.subject,/);
  assert.ok(sql.includes("'\\s+', ' ', 'g'"));
});

test("follow-up UI keeps reviewed selections, blocks silent loss of unsaved drafts", async () => {
  const page = await (await import("node:fs/promises")).readFile(
    new URL("../src/pages/admin/emails/followups.astro",import.meta.url),"utf8"
  );
  assert.match(page,/const selectedDrafts = new Set<string>\(\)/);
  assert.match(page,/renderDraftSelection\(\)/);
  assert.match(page,/const validDraftIds = new Set/);
  assert.match(page,/dirtyDraftIds\(\)/);
  assert.match(page,/Failed edits must stay visible/);
  assert.match(page,/confirmDiscardEdits\(\)/);
  assert.match(page,/select-approved-drafts/);
});

test("functional follow-up: unauthenticated requests cannot read or send", async () => {
  const route=await handlers(); const env=setup();
  env.authorized=false;
  assert.equal((await route.GET(context("GET"))).status,401);
  assert.equal((await route.POST(context("POST",{action:"send",ids:["source-001"]}))).status,401);
  assert.equal((await route.PATCH(context("PATCH",{action:"approve",id:"draft-1",subject:"Re: Test",body:"Test"}))).status,401);
});
