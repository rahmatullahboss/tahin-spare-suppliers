import type { APIRoute } from "astro";
import { requireAdminRequest } from "../../../../../lib/server/api";
import { ensureSchema, getDb } from "../../../../../lib/server/db";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const env = await requireAdminRequest(context);
    if (!env) return new Response("Unauthorized", { status: 401 });

    const { url } = context;
    await ensureSchema(env);
    const sql = getDb(env);

    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const search = url.searchParams.get("search") ?? "";
    const filter = url.searchParams.get("filter") ?? "all"; // all, unread, read
    const offset = (page - 1) * limit;

    let whereClause = "";
    const params: (string | number)[] = [];

    if (search) {
      whereClause = ` WHERE (from_address ILIKE $1 OR subject ILIKE $1)`;
      params.push(`%${search}%`);
    }

    if (filter === "unread") {
      whereClause += whereClause ? " AND is_read = false" : " WHERE is_read = false";
    } else if (filter === "read") {
      whereClause += whereClause ? " AND is_read = true" : " WHERE is_read = true";
    }

    const [emailsResult, countResult] = await Promise.all([
      sql.query(
        `SELECT id, from_address, to_address, subject, body, attachments_json, is_read, created_at
         FROM inbound_emails${whereClause}
         ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      sql.query(`SELECT COUNT(*) as total FROM inbound_emails${whereClause}`, params),
    ]);

    const total = countResult[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);
    const unreadCount = (await sql.query(`SELECT COUNT(*) as total FROM inbound_emails WHERE is_read = false`))[0]?.total ?? 0;

    return Response.json({ emails: emailsResult, total, page, totalPages, unreadCount });
  } catch (error) {
    console.error("List inbound emails error:", error);
    return Response.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
};
