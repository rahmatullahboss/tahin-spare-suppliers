import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../lib/server/env";
import { ensureSchema, getDb } from "../../../lib/server/db";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const env = getRuntimeEnv(Astro.locals);
    await ensureSchema(env);
    const sql = getDb(env);

    const { id } = params;
    const result = await sql.query(
      `SELECT id, to_address, from_address, subject, body, created_at
       FROM sent_emails WHERE id = $1`,
      [id]
    );

    if (result.length === 0) {
      return Response.json({ error: "Email not found" }, { status: 404 });
    }

    return Response.json(result[0]);
  } catch (error) {
    console.error("Get email error:", error);
    return Response.json({ error: "Failed to fetch email" }, { status: 500 });
  }
};