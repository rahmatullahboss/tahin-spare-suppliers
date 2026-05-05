import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../lib/server/env";
import { ensureSchema, getDb } from "../../../lib/server/db";
import { sendEmail } from "../../../lib/server/email";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const env = getRuntimeEnv(locals);
    await ensureSchema(env);
    const sql = getDb(env);

    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const search = url.searchParams.get("search") ?? "";
    const offset = (page - 1) * limit;

    let query = `SELECT id, to_address, subject, created_at FROM sent_emails`;
    let countQuery = `SELECT COUNT(*) as total FROM sent_emails`;
    const params: (string | number)[] = [];

    if (search) {
      query += ` WHERE to_address ILIKE $1 OR subject ILIKE $1`;
      countQuery += ` WHERE to_address ILIKE $1 OR subject ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [emailsResult, countResult] = await Promise.all([
      sql.query(query, params),
      sql.query(countQuery, search ? [`%${search}%`] : []),
    ]);

    const total = countResult[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return Response.json({
      emails: emailsResult,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    console.error("List emails error:", error);
    return Response.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = getRuntimeEnv(locals);
    await ensureSchema(env);
    const sql = getDb(env);

    const body = await request.json();
    const { to, subject, body: emailBody } = body;

    if (!to || !subject || !emailBody) {
      return Response.json(
        { error: "To, subject and body are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return Response.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const result = await sendEmail(env, to, subject, emailBody);
    const id = result.id;

    await sql.query(
      `INSERT INTO sent_emails (id, to_address, from_address, subject, body, resend_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, to, "contact@tahinspare.com", subject, emailBody, result.resendId]
    );

    return Response.json({ ok: true, id, resendId: result.resendId });
  } catch (error) {
    console.error("Send email error:", error);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
};
