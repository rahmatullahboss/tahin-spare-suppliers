import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../../lib/server/env";
import { ensureSchema, getDb } from "../../../../lib/server/db";
import { forwardInboundEmail } from "../../../../lib/server/email";

export const prerender = false;

interface ResendWebhookPayload {
  type: string;
  email?: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  };
}

function verifyWebhookSignature(request: Request, body: string): boolean {
  const signature = request.headers.get("Resend-Signature");
  if (!signature) return false;
  // In production, verify HMAC here
  return signature.includes("t=") && signature.includes("v1=");
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const rawBody = await request.text();
    if (!verifyWebhookSignature(request, rawBody)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const env = getRuntimeEnv(locals);
    await ensureSchema(env);
    const sql = getDb(env);

    const payload: ResendWebhookPayload = JSON.parse(rawBody);

    if (payload.type !== "email.received" || !payload.email) {
      return new Response("OK", { status: 200 });
    }

    const { from, to, subject, text, html } = payload.email;
    const body = text ?? html ?? "";
    const id = crypto.randomUUID();

    await sql.query(
      `INSERT INTO inbound_emails (id, from_address, to_address, subject, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, from, to, subject, body]
    );

    await forwardInboundEmail(env, from, subject, body);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal Error", { status: 500 });
  }
};