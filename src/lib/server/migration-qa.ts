import { ensureSchema, getDb } from "./db";
import type { RuntimeEnv } from "./env";

/** Fixed synthetic fixture only; no customer data, mail delivery or permanent SQL changes. */
export async function runMigrationQa(env: RuntimeEnv): Promise<string[]> {
  if (env.DB_PROVIDER !== "supabase" || !env.SUPABASE_HYPERDRIVE) throw new Error("QA requires Supabase Hyperdrive");
  await ensureSchema(env);
  const sql = getDb(env);
  const identity = await sql.query("SELECT current_user = 'tahin_worker' AS role_ok");
  if (identity[0]?.role_ok !== true) throw new Error("Unexpected database role");
  const id = `migration-qa-${crypto.randomUUID()}`;
  let rolledBack = false;
  try {
    await sql.transaction([
      sql`INSERT INTO products(id,slug,name) VALUES(${id},${id},'QA fixture')`,
      sql`UPDATE products SET name='QA updated' WHERE id=${id}`,
      sql`SELECT 1 / CASE WHEN EXISTS(SELECT 1 FROM products WHERE id=${id} AND name='QA updated') THEN 1 ELSE 0 END`,
      sql`INSERT INTO page_sections(page_key,section_key,content_json) VALUES(${id},'hero','{"title":"QA"}'::jsonb)`,
      sql`UPDATE page_sections SET content_json='{"title":"QA updated"}'::jsonb WHERE page_key=${id}`,
      sql`INSERT INTO contact_messages(id,name,email,message) VALUES(${id},'QA','qa@example.invalid','QA')`,
      sql`INSERT INTO enquiries(id,name,email,message) VALUES(${id},'QA','qa@example.invalid','QA')`,
      sql`INSERT INTO brands(id,name,slug) VALUES(${id},${id},${id})`,
      sql`INSERT INTO categories(id,name,slug) VALUES(${id},${id},${id})`,
      sql`INSERT INTO product_category_assignments(product_id,category_name) VALUES(${id},${id})`,
      sql`INSERT INTO sent_emails(id,to_address,subject,body) VALUES(${id},'qa@example.invalid','QA','QA')`,
      sql`INSERT INTO inbound_emails(id,from_address,to_address,subject) VALUES(${id},'qa@example.invalid','qa@example.invalid','QA')`,
      sql`INSERT INTO email_followup_drafts(id,source_sent_id,recipient,subject,body) VALUES(${id},${id},'qa@example.invalid','QA','QA')`,
      sql`DELETE FROM products WHERE id=${id}`,
      // Raise a distinct SQLSTATE at the very end, forcing the adapter to roll back.
      sql`DO $$ BEGIN RAISE EXCEPTION USING ERRCODE='P0099', MESSAGE='QA rollback'; END $$`,
    ]);
  } catch (error) {
    if ((error as {code?: string})?.code !== "P0099") throw new Error("Database fixture transaction failed");
    rolledBack = true;
  }
  if (!rolledBack) throw new Error("Expected rollback was not observed");
  const rows = await sql`SELECT NOT EXISTS(SELECT 1 FROM page_sections WHERE page_key=${id}) AND NOT EXISTS(SELECT 1 FROM contact_messages WHERE id=${id}) AND NOT EXISTS(SELECT 1 FROM enquiries WHERE id=${id}) AND NOT EXISTS(SELECT 1 FROM brands WHERE id=${id}) AND NOT EXISTS(SELECT 1 FROM categories WHERE id=${id}) AND NOT EXISTS(SELECT 1 FROM sent_emails WHERE id=${id}) AND NOT EXISTS(SELECT 1 FROM inbound_emails WHERE id=${id}) AND NOT EXISTS(SELECT 1 FROM email_followup_drafts WHERE id=${id}) AND NOT EXISTS(SELECT 1 FROM products WHERE id=${id}) AND NOT EXISTS(SELECT 1 FROM product_category_assignments WHERE product_id=${id}) AS clean`;
  if (rows[0]?.clean !== true) throw new Error("Database fixture cleanup verification failed");
  const key = `migration-qa/${id}.png`;
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR2sAAAAASUVORK5CYII="), c => c.charCodeAt(0));
  try {
    await env.MEDIA_BUCKET.put(key, png, { httpMetadata: { contentType: "image/png" } });
    const object = await env.MEDIA_BUCKET.get(key);
    if (!object || object.httpMetadata?.contentType !== "image/png") throw new Error("R2 image metadata failed");
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (bytes.length !== png.length || bytes.some((v,i)=>v!==png[i])) throw new Error("R2 image content failed");
  } finally {
    await env.MEDIA_BUCKET.delete(key);
  }
  if (await env.MEDIA_BUCKET.head(key)) throw new Error("R2 fixture cleanup failed");
  return ["Hyperdrive restricted login and schema: PASS", "Product create/update/delete, CMS, category, brand, contact, enquiry and mail-record transaction: PASS", "Database rollback and cleanup: PASS", "Isolated R2 image put/get/delete: PASS", "No external emails sent. Admin UI and production cutover still require separate verification."];
}
