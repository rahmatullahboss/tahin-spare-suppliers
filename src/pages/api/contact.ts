import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../lib/server/env";
import { ensureSchema, getDb } from "../../lib/server/db";

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

    if (env.RESEND_API_KEY) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Tahin Spare Suppliers <onboarding@resend.dev>",
          to: ["sales@tahinspare.com"],
          subject: `New Contact from ${name}${subject ? ` — ${subject}` : ""}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #c0392b; padding: 20px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 22px;">New Website Contact</h1>
              </div>
              <div style="padding: 25px; background: #f9f9f9;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #eee; width: 140px;">Name:</td>
                    <td style="padding: 10px; color: #555; border-bottom: 1px solid #eee;">${name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #eee;">Email:</td>
                    <td style="padding: 10px; color: #555; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: #eee; vertical-align: top;">Subject:</td>
                    <td style="padding: 10px; color: #555; border-bottom: 1px solid #eee;">${subject || "Not provided"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; font-weight: bold; color: #333; vertical-align: top;">Message:</td>
                    <td style="padding: 10px; color: #555; white-space: pre-wrap;">${message}</td>
                  </tr>
                </table>
              </div>
              <div style="padding: 15px; text-align: center; font-size: 12px; color: #999;">
                Sent from Tahin Spare Suppliers website
              </div>
            </div>
          `,
        }),
      });

      if (!resendRes.ok) {
        console.error("Resend API error:", await resendRes.text());
      }
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Failed to submit message." },
      { status: 500 }
    );
  }
};
