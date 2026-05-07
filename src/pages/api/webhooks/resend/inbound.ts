import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../../lib/server/env";
import { ensureSchema, getDb } from "../../../../lib/server/db";
import {
  forwardInboundEmail,
  getReceivedEmail,
  verifyResendWebhook,
} from "../../../../lib/server/email";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const rawBody = await request.text();
    const env = getRuntimeEnv(locals);
    let payload: ReturnType<typeof verifyResendWebhook>;
    try {
      payload = verifyResendWebhook(env, rawBody, request.headers);
    } catch (error) {
      console.error("Invalid Resend webhook:", error);
      return new Response("Unauthorized", { status: 401 });
    }

    if (payload.type !== "email.received") {
      return new Response("OK", { status: 200 });
    }

    await ensureSchema(env);
    const sql = getDb(env);

    const received = await getReceivedEmail(env, payload.data.email_id);
    const from = received.from;
    const to = received.to.join(", ");
    const subject = received.subject;
    const body = received.text ?? "";
    const htmlBody = received.html ?? "";
    const id = crypto.randomUUID();
    const existing = await sql.query(
      `SELECT id FROM inbound_emails WHERE resend_email_id = $1 LIMIT 1`,
      [received.id]
    );

    if (existing.length > 0) {
      return new Response("OK", { status: 200 });
    }

    await sql.query(
      `INSERT INTO inbound_emails (
         id, from_address, to_address, subject, body, resend_email_id,
         message_id, html_body, attachments_json, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        from,
        to,
        subject,
        body || htmlBody,
        received.id,
        received.message_id,
        htmlBody,
        JSON.stringify(received.attachments),
        received.created_at,
      ]
    );

    await forwardInboundEmail(env, from, subject, body || htmlBody);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal Error", { status: 500 });
  }
};
