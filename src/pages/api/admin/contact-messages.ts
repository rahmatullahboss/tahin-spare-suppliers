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
    const messages = await sql.query(
      `SELECT id, name, email, subject, message, created_at
       FROM contact_messages
       ORDER BY created_at DESC`
    );

    return Response.json(messages);
  } catch {
    return Response.json(
      { error: "Failed to fetch messages." },
      { status: 500 }
    );
  }
};