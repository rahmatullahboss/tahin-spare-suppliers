import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../lib/server/env";
import { ensureSchema, getDb } from "../../lib/server/db";

export const POST: APIRoute = async (context) => {
  try {
    const env = getRuntimeEnv(context.locals);
    await ensureSchema(env);
    const formData = await context.request.formData();

    // Check honeypot
    const gotcha = formData.get("_gotcha");
    if (gotcha) {
      return Response.json({ ok: true });
    }

    const name = formData.get("name")?.toString().trim() ?? "";
    const email = formData.get("email")?.toString().trim() ?? "";
    const subject = formData.get("subject")?.toString().trim() ?? "";
    const message = formData.get("message")?.toString().trim() ?? "";

    if (!name || !email || !message) {
      return Response.json(
        { error: "Name, email and message are required." },
        { status: 400 }
      );
    }

    const sql = getDb(env);
    const id = crypto.randomUUID();
    await sql.query(
      `INSERT INTO contact_messages (id, name, email, subject, message) VALUES ($1, $2, $3, $4, $5)`,
      [id, name, email, subject, message]
    );

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Failed to submit message." },
      { status: 500 }
    );
  }
};
