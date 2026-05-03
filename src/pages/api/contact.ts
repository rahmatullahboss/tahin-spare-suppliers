import type { APIRoute } from "astro";
import { Resend } from "resend";
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

    // Save to database
    await sql.query(
      `INSERT INTO contact_messages (id, name, email, subject, message) VALUES ($1, $2, $3, $4, $5)`,
      [id, name, email, subject, message]
    );

    // Send email via Resend (if API key is configured)
    if (env.RESEND_API_KEY) {
      try {
        const resend = new Resend(env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Contact Form <contact@tahinspare.com>",
          to: ["tahinship@gmail.com"],
          subject: `New Contact: ${name} - ${subject || "(No subject)"}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject || "N/A"}</p>
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, "<br>")}</p>
          `
        });
      } catch (emailError) {
        console.error("Email send failed (continuing without email):", emailError);
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Contact error:", error);
    return Response.json(
      { error: "Failed to submit message." },
      { status: 500 }
    );
  }
};
