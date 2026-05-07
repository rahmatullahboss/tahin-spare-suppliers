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
    const phone = formData.get("phone")?.toString().trim() ?? "";
    const equipment = formData.get("equipment")?.toString().trim() ?? "";
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
      `INSERT INTO enquiries (id, name, email, phone, equipment, message) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, name, email, phone, equipment, message]
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
          subject: `New Enquiry from ${name} — ${equipment}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #c0392b; padding: 20px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 22px;">New Website Enquiry</h1>
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
                    <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #eee;">Phone:</td>
                    <td style="padding: 10px; color: #555; border-bottom: 1px solid #eee;">${phone || "Not provided"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; font-weight: bold; color: #333; border-bottom: 1px solid #eee;">Equipment:</td>
                    <td style="padding: 10px; color: #555; border-bottom: 1px solid #eee;">${equipment || "Not specified"}</td>
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
      { error: "Failed to submit enquiry." },
      { status: 500 }
    );
  }
};
