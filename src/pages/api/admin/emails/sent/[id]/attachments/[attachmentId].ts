import type { APIRoute } from "astro";
import { requireAdminRequest } from "../../../../../../../lib/server/api";
import { ensureSchema, getDb } from "../../../../../../../lib/server/db";
import { isSafeInlineImageContentType } from "../../../../../../../lib/server/email-content";
import { getSentEmailAttachmentByMetadata } from "../../../../../../../lib/server/email-service";
import {
  findStoredSentAttachment,
} from "../../../../../../../lib/server/sent-email-attachments";

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
      `SELECT attachments_json, resend_id FROM sent_emails WHERE id = $1 LIMIT 1`,
      [emailId]
    );
    if (rows.length === 0) {
      return Response.json({ error: "Email not found" }, { status: 404 });
    }

    // The selected sent_emails row is the authorization scope for its manifest.
    // Bulk sends intentionally share one private R2 object set across recipient
    // rows, so the storage prefix is not always the row's local email id.
    const attachment = findStoredSentAttachment(rows[0]?.attachments_json, attachmentId);
    if (!attachment) {
      return Response.json({ error: "Attachment not found" }, { status: 404 });
    }

    const object = await env.MEDIA_BUCKET.get(attachment.storageKey);
    let responseBody = object?.body ?? null;
    let contentType = object?.httpMetadata?.contentType
      || attachment.contentType
      || "application/octet-stream";

    if (!responseBody) {
      const resendId = typeof rows[0]?.resend_id === "string" ? rows[0].resend_id : "";
      if (!resendId) {
        return Response.json({ error: "Attachment not found" }, { status: 404 });
      }

      try {
        const remoteAttachment = await getSentEmailAttachmentByMetadata(env, resendId, {
          filename: attachment.filename,
          contentId: attachment.contentId,
        });
        const remoteResponse = await fetch(remoteAttachment.download_url);
        if (!remoteResponse.ok || !remoteResponse.body) {
          return Response.json({ error: "Attachment download failed" }, { status: 502 });
        }

        responseBody = remoteResponse.body;
        contentType = remoteAttachment.content_type
          || remoteResponse.headers.get("content-type")
          || contentType;
      } catch (error) {
        console.error("Sent attachment fallback error:", error);
        return Response.json({ error: "Attachment not found" }, { status: 404 });
      }
    }

    const inlineSafe = isSafeInlineImageContentType(contentType);
    const download = context.url.searchParams.get("download") === "1" || !inlineSafe;
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", contentDisposition(attachment.filename, download));
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(responseBody, { headers });
  } catch (error) {
    console.error("Get sent attachment error:", error);
    return Response.json({ error: "Failed to fetch attachment" }, { status: 500 });
  }
};
