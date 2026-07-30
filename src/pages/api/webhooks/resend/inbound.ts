import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../../lib/server/env";
import { ensureSchema, getDb } from "../../../../lib/server/db";
import {
  forwardInboundEmail,
  getReceivedEmail,
  verifyResendWebhook,
} from "../../../../lib/server/email-service";

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
      const trackedDeliveryEvents = new Set([
        "email.sent",
        "email.delivered",
        "email.delivery_delayed",
        "email.failed",
        "email.bounced",
        "email.suppressed",
        "email.complained",
      ]);
      const eventType = String(payload.type);

      if (trackedDeliveryEvents.has(eventType)) {
        const eventData = payload.data as unknown as Record<string, unknown>;
        const emailId = typeof eventData.email_id === "string" ? eventData.email_id : "";
        const rawError = eventData.error;
        const errorMessage = typeof rawError === "string"
          ? rawError
          : rawError && typeof rawError === "object" && "message" in rawError
            ? String((rawError as { message?: unknown }).message ?? "")
            : "";

        if (emailId) {
          await ensureSchema(env);
          const sql = getDb(env);
          await sql.query(
            `UPDATE sent_emails
             SET delivery_status = $2, delivery_error = $3, last_event_at = NOW()
             WHERE resend_id = $1`,
            [emailId, eventType.replace(/^email\./, ""), errorMessage.slice(0, 2000)]
          );
        }
      }

      return new Response("OK", { status: 200 });
    }

    await ensureSchema(env);
    const sql = getDb(env);
    const received = await getReceivedEmail(env, payload.data.email_id);
    const id = crypto.randomUUID();

    await sql.query(
      `INSERT INTO inbound_emails (
         id, from_address, to_address, subject, body, resend_email_id,
         message_id, html_body, attachments_json, created_at, forward_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       ON CONFLICT DO NOTHING`,
      [
        id,
        received.from,
        received.to.join(", "),
        received.subject,
        received.text || received.html || "",
        received.id,
        received.message_id,
        received.html ?? "",
        JSON.stringify(received.attachments ?? []),
        received.created_at,
      ]
    );

    const claimed = await sql.query(
      `UPDATE inbound_emails
       SET forward_status = 'processing',
           forward_attempts = forward_attempts + 1,
           forward_attempted_at = NOW(),
           forward_error = ''
       WHERE resend_email_id = $1
         AND forward_status <> 'forwarded'
         AND (
           forward_status IN ('pending', 'failed')
           OR forward_attempted_at IS NULL
           OR forward_attempted_at < NOW() - INTERVAL '5 minutes'
         )
       RETURNING id`,
      [received.id]
    );

    if (claimed.length === 0) {
      return new Response("OK", { status: 200 });
    }

    const inboundId = claimed[0].id as string;
    try {
      await forwardInboundEmail(env, received.id);
      await sql.query(
        `UPDATE inbound_emails
         SET forward_status = 'forwarded', forwarded_at = NOW(), forward_error = ''
         WHERE id = $1`,
        [inboundId]
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message.slice(0, 2000)
        : "Failed to forward received email";
      await sql.query(
        `UPDATE inbound_emails
         SET forward_status = 'failed', forward_error = $2
         WHERE id = $1`,
        [inboundId, message]
      );
      throw error;
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal Error", { status: 500 });
  }
};
