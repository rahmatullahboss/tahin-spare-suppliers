import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../lib/server/env";
import { ensureSchema, getDb } from "../../lib/server/db";
import { plainTextEmailToHtml, sanitizeEmailHeader } from "../../lib/server/email-content";
import { sendEmail } from "../../lib/server/email-service";

export const POST: APIRoute = async (context) => {
  try {
    const env = getRuntimeEnv(context.locals);
    await ensureSchema(env);
    const formData = await context.request.formData();

    const gotcha = formData.get("_gotcha");
    if (gotcha) {
      return Response.json({ ok: true });
    }

    const name = formData.get("name")?.toString().trim() ?? "";
    const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
    const subject = formData.get("subject")?.toString().trim() ?? "";
    const message = formData.get("message")?.toString().trim() ?? "";

    if (!name || !email || !message) {
      return Response.json(
        { error: "Name, email and message are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
    }

    if (name.length > 120 || email.length > 254 || subject.length > 200 || message.length > 5000) {
      return Response.json({ error: "Submitted message is too long." }, { status: 400 });
    }

    const sql = getDb(env);
    const id = crypto.randomUUID();
    await sql.query(
      `INSERT INTO contact_messages (id, name, email, subject, message) VALUES ($1, $2, $3, $4, $5)`,
      [id, name, email, subject, message]
    );

    let notificationSent = false;
    if (env.RESEND_API_KEY) {
      const safeName = plainTextEmailToHtml(name);
      const safeEmail = plainTextEmailToHtml(email);
      const safeSubject = plainTextEmailToHtml(subject || "Not provided");
      const safeMessage = plainTextEmailToHtml(message);

      try {
        await sendEmail(env, {
          to: env.NOTIFICATION_EMAIL || "tahinship@gmail.com",
          subject: sanitizeEmailHeader(
            `New Contact from ${name}${subject ? ` — ${subject}` : ""}`
          ),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #c0392b; padding: 20px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 22px;">New Website Contact</h1>
              </div>
              <div style="padding: 25px; background: #f9f9f9;">
                <p><strong>Name:</strong> ${safeName}</p>
                <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
                <p><strong>Subject:</strong> ${safeSubject}</p>
                <p><strong>Message:</strong></p>
                <div style="white-space: pre-wrap;">${safeMessage}</div>
              </div>
            </div>
          `,
          text: `New website contact\nName: ${name}\nEmail: ${email}\nSubject: ${subject || "Not provided"}\n\n${message}`,
          replyTo: email,
          idempotencyKey: `contact/${id}`,
        });
        notificationSent = true;
      } catch (error) {
        console.error("Contact notification email failed:", {
          contactId: id,
          error: error instanceof Error ? error.message : "Unknown email error",
        });
      }
    }

    return Response.json({ ok: true, notificationSent });
  } catch (error) {
    console.error("Contact submission failed:", error);
    return Response.json(
      { error: "Failed to submit message." },
      { status: 500 }
    );
  }
};
