import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../lib/server/env";
import { getDb } from "../../../lib/server/db";
import { isAuthenticated } from "../../../lib/server/session";

export const GET: APIRoute = async (context) => {
  const env = getRuntimeEnv(context.locals);
  const authenticated = await isAuthenticated(context.cookies, env.SESSION_SECRET);

  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb(env);
    const url = new URL(context.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
    const offset = (page - 1) * limit;
    const search = url.searchParams.get("search") ?? undefined;

    let countQuery = "SELECT COUNT(*) as total FROM contact_messages";
    let query = `SELECT id, name, email, subject, message, created_at FROM contact_messages`;

    if (search) {
      const searchCondition = ` WHERE name ILIKE $1 OR email ILIKE $1 OR subject ILIKE $1 OR message ILIKE $1`;
      countQuery += searchCondition;
      query += searchCondition;
      query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      const [countResult, items] = await Promise.all([
        sql.query(countQuery, [`%${search}%`]),
        sql.query(query, [`%${search}%`])
      ]);

      const total = Number(countResult[0]?.total ?? 0);
      const totalPages = Math.ceil(total / limit);
      return Response.json({ items, total, page, totalPages, limit });
    } else {
      query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      const [countResult, items] = await Promise.all([
        sql.query(countQuery),
        sql.query(query)
      ]);

      const total = Number(countResult[0]?.total ?? 0);
      const totalPages = Math.ceil(total / limit);
      return Response.json({ items, total, page, totalPages, limit });
    }
  } catch {
    return Response.json(
      { error: "Failed to fetch messages." },
      { status: 500 }
    );
  }
};