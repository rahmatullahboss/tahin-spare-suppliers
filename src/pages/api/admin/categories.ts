import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../lib/server/env";
import { getDb } from "../../../lib/server/db";
import { isAuthenticated } from "../../../lib/server/session";

export const GET: APIRoute = async (context) => {
  const authenticated = await isAuthenticated(context.cookies, getRuntimeEnv(context.locals).SESSION_SECRET);
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb(getRuntimeEnv(context.locals));
    const categories = await sql.query(`SELECT id, name, slug, created_at FROM categories ORDER BY name`);
    return Response.json(categories);
  } catch {
    return Response.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const authenticated = await isAuthenticated(context.cookies, getRuntimeEnv(context.locals).SESSION_SECRET);
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await context.request.json() as { name?: string };
    if (!name?.trim()) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const sql = getDb(getRuntimeEnv(context.locals));

    await sql.query(`INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3)`, [id, name.trim(), slug]);
    return Response.json({ id, name: name.trim(), slug });
  } catch {
    return Response.json({ error: "Failed to create category" }, { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const authenticated = await isAuthenticated(context.cookies, getRuntimeEnv(context.locals).SESSION_SECRET);
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.request.json() as { id?: string };
    if (!id) {
      return Response.json({ error: "ID is required" }, { status: 400 });
    }

    const sql = getDb(getRuntimeEnv(context.locals));
    await sql.query(`DELETE FROM categories WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed to delete category" }, { status: 500 });
  }
};