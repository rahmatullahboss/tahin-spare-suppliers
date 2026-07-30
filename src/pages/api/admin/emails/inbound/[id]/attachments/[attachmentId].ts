import type { APIRoute } from "astro";
import { requireAdminRequest } from "../../../../../../../lib/server/api";
import { ensureSchema, getDb } from "../../../../../../../lib/server/db";
import {
  isSafeInlineImageContentType,
  parseInboundAttachments,
} from "../../../../../../../lib/server/email-content";
import { getReceivedEmailAttachment } from "../../../../../../../lib/server/email-service";

export const prerender = false;

function contentDisposition(filename: string, download: boolean): string {
  const disposition = download ? "attachment" : "inline";
  const safeFilename = filename.replace(/[\r\n"]/g, "").trim() || "attachment";
  return `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`;
}

export const GET: APIRoute = async (context) => {
  try {
    const env = await requireAdminRequest(context);
    if (!env) return new Response("Unauthorized", { status: 401 });

    const emailId = context.params.id ?? "";
    const attachmentId = context.params.attachmentId ?? "";
    if (!emailId || !attachmentId) {
      return Response.json({ error: "Missing attachment id" }, { status: 400 });
    }

    await ensureSchema(env);
    const sql = getDb(env);
    const rows = await sql.query(
      `SELECT resend_email_id, attachments_json FROM inbound_emails WHERE id = $1 LIMIT 1`,
      [emailId]
    );

    if (rows.length === 0) {
      return Response.json({ error: "Email not found" }, { status: 404 });
    }

    const attachments = parseInboundAttachments(rows[0]?.attachments_json);
    const attachment = attachments.find((item) => item.id === attachmentId);
    const resendEmailId = typeof rows[0]?.resend_email_id === "string"
      ? rows[0].resend_email_id
      : "";

    if (!attachment || !resendEmailId) {
      return Response.json({ error: "Attachment not found" }, { status: 404 });
    }

    const remoteAttachment = await getReceivedEmailAttachment(
      env,
      resendEmailId,
      attachmentId
    );
    const remoteResponse = await fetch(remoteAttachment.download_url);
    if (!remoteResponse.ok || !remoteResponse.body) {
      return Response.json({ error: "Attachment download failed" }, { status: 502 });
    }

    const contentType = remoteAttachment.content_type || attachment.contentType;
    const inlineSafe = isSafeInlineImageContentType(contentType);
    const download = context.url.searchParams.get("download") === "1" || !inlineSafe;
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", contentDisposition(attachment.filename, download));
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(remoteResponse.body, { headers });
  } catch (error) {
    console.error("Get inbound attachment error:", error);
    return Response.json({ error: "Failed to fetch attachment" }, { status: 500 });
  }
};
