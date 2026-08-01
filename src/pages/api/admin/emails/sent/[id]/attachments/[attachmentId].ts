import type { APIRoute } from "astro";
import { requireAdminRequest } from "../../../../../../../lib/server/api";
import { ensureSchema, getDb } from "../../../../../../../lib/server/db";
import { isSafeInlineImageContentType } from "../../../../../../../lib/server/email-content";
import { parseStoredSentAttachments } from "../../../../../../../lib/server/sent-email-attachments";

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
      `SELECT attachments_json FROM sent_emails WHERE id = $1 LIMIT 1`,
      [emailId]
    );
    if (rows.length === 0) {
      return Response.json({ error: "Email not found" }, { status: 404 });
    }

    const attachments = parseStoredSentAttachments(rows[0]?.attachments_json);
    const attachment = attachments.find((item) => item.id === attachmentId);
    if (!attachment) {
      return Response.json({ error: "Attachment not found" }, { status: 404 });
    }

    const expectedPrefix = `email/sent/${emailId.replace(/[^a-zA-Z0-9._-]+/g, "-")}/`;
    if (!attachment.storageKey.startsWith(expectedPrefix)) {
      return Response.json({ error: "Attachment not found" }, { status: 404 });
    }

    const object = await env.MEDIA_BUCKET.get(attachment.storageKey);
    if (!object?.body) {
      return Response.json({ error: "Attachment not found" }, { status: 404 });
    }

    const contentType = object.httpMetadata?.contentType || attachment.contentType || "application/octet-stream";
    const inlineSafe = isSafeInlineImageContentType(contentType);
    const download = context.url.searchParams.get("download") === "1" || !inlineSafe;
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", contentDisposition(attachment.filename, download));
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Get sent attachment error:", error);
    return Response.json({ error: "Failed to fetch attachment" }, { status: 500 });
  }
};
