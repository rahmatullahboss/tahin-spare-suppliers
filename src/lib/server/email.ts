import { Resend } from "resend";
import type { RuntimeEnv } from "./env";

export interface EmailResult {
  id: string;
  resendId: string;
}

export function getResendClient(env: RuntimeEnv): Resend {
  return new Resend(env.RESEND_API_KEY);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendEmail(
  env: RuntimeEnv,
  to: string,
  subject: string,
  body: string
): Promise<EmailResult> {
  const resend = getResendClient(env);
  const result = await resend.emails.send({
    from: `Tahin Spare Suppliers <contact@tahinspare.com>`,
    to: [to],
    subject,
    html: body,
  });

  return {
    id: crypto.randomUUID(),
    resendId: result.data?.id ?? "",
  };
}

export async function forwardInboundEmail(
  env: RuntimeEnv,
  from: string,
  originalSubject: string,
  body: string,
  toEmail: string = "tahinship@gmail.com"
): Promise<void> {
  const resend = getResendClient(env);
  await resend.emails.send({
    from: `Tahin Spare Suppliers <contact@tahinspare.com>`,
    to: [toEmail],
    subject: `[Forwarded] ${originalSubject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #c0392b; padding: 20px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">New Email Received</h1>
        </div>
        <div style="padding: 25px; background: #f9f9f9;">
          <p><strong>From:</strong> ${escapeHtml(from)}</p>
          <p><strong>Subject:</strong> ${escapeHtml(originalSubject)}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <div style="white-space: pre-wrap;">${escapeHtml(body)}</div>
        </div>
        <div style="padding: 15px; text-align: center; font-size: 12px; color: #999;">
          Reply to this email at: contact@tahinspare.com
        </div>
      </div>
    `,
    replyTo: "contact@tahinspare.com",
  });
}
