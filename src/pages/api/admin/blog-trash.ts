import type { APIRoute } from "astro";
import { requireAdminRequest } from "../../../lib/server/api";
import { ensureSchema, getDb } from "../../../lib/server/db";
import { notifyContentChange } from "../../../lib/server/indexnow";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return new Response("Unauthorized", { status: 401 });
  try {
    await ensureSchema(env);
    const sql = getDb(env);
    const items = await sql.query(
      "SELECT id, slug, title, deleted_at FROM blog_posts WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200"
    );
    return Response.json({ items });
  } catch (error) {
    console.error("Blog trash list error:", error);
    return Response.json({ error: "Cannot load Trash." }, { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return new Response("Unauthorized", { status: 401 });
  try {
    const payload = await context.request.json() as { id?: unknown };
    if (typeof payload.id !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(payload.id)) {
      return Response.json({ error: "Invalid post ID." }, { status: 400 });
    }
    await ensureSchema(env);
    const sql = getDb(env);
    const restored = await sql.query(
      "UPDATE blog_posts SET deleted_at = NULL, updated_at = NOW() WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id, slug",
      [payload.id]
    );
    if (!restored.length) return Response.json({ error: "Post is not in Trash." }, { status: 404 });
    const notification = notifyContentChange(env, "blog", [String(restored[0].slug)]);
    if (context.locals.cfContext?.waitUntil) context.locals.cfContext.waitUntil(notification);
    else await notification;
    return Response.json({ ok: true, slug: restored[0].slug });
  } catch (error) {
    console.error("Blog restore error:", error);
    return Response.json({ error: "Could not restore this post." }, { status: 500 });
  }
};
