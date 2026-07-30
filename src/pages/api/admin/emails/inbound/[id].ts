import type { APIRoute } from "astro";
import { requireAdminRequest } from "../../../../../lib/server/api";
import { ensureSchema, getDb } from "../../../../../lib/server/db";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const env = await requireAdminRequest(context);
    if (!env) return new Response("Unauthorized", { status: 401 });

    const { params } = context;
    await ensureSchema(env);
    const sql = getDb(env);

    const { id } = params;
    const result = await sql.query(
      `SELECT id, from_address, to_address, subject, body, is_read, created_at
       FROM inbound_emails WHERE id = $1`,
      [id]
    );

    if (result.length === 0) {
      return Response.json({ error: "Email not found" }, { status: 404 });
    }

    // Mark as read when viewed
    await sql.query(`UPDATE inbound_emails SET is_read = true WHERE id = $1`, [id]);

    return Response.json(result[0]);
  } catch (error) {
    console.error("Get inbound email error:", error);
    return Response.json({ error: "Failed to fetch email" }, { status: 500 });
  }
};
