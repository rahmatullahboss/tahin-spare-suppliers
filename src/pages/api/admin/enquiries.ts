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
    const enquiries = await sql.query(
      `SELECT id, name, email, phone, equipment, message, created_at
       FROM enquiries
       ORDER BY created_at DESC`
    );

    return Response.json(enquiries);
  } catch {
    return Response.json(
      { error: "Failed to fetch enquiries." },
      { status: 500 }
    );
  }
};