import type { APIRoute } from "astro";
import { requireAdminRequest } from "../../../../lib/server/api";
import { ensureSchema, getDb } from "../../../../lib/server/db";
import {
  filterReferencedInlineImages,
  sendEmail,
  type EmailFileAttachmentInput,
  type InlineEmailImageInput
} from "../../../../lib/server/email-service";
import {
  deleteStoredSentEmailAttachments,
  storeSentEmailAttachments,
} from "../../../../lib/server/sent-email-attachments";

export const prerender = false;

type SendEmailRequestBody = {
  to?: unknown;
  subject?: unknown;
  body?: unknown;
  inReplyToId?: unknown;
  requestId?: unknown;
  inlineImages?: unknown;
  fileAttachments?: unknown;
};

export const GET: APIRoute = async (context) => {
  try {
    const env = await requireAdminRequest(context);
    if (!env) return new Response("Unauthorized", { status: 401 });

    const { url } = context;
    await ensureSchema(env);
    const sql = getDb(env);

    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const search = url.searchParams.get("search") ?? "";
    const offset = (page - 1) * limit;

    let query = `SELECT id, to_address, subject, body, attachments_json, delivery_status, delivery_error, created_at FROM sent_emails`;
    let countQuery = `SELECT COUNT(*) as total FROM sent_emails`;
    const params: (string | number)[] = [];

    if (search) {
      query += ` WHERE to_address ILIKE $1 OR subject ILIKE $1`;
      countQuery += ` WHERE to_address ILIKE $1 OR subject ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [emailsResult, countResult] = await Promise.all([
      sql.query(query, params),
      sql.query(countQuery, search ? [`%${search}%`] : []),
    ]);

    const total = countResult[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return Response.json({
      emails: emailsResult,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    console.error("List emails error:", error);
    return Response.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const env = await requireAdminRequest(context);
    if (!env) return new Response("Unauthorized", { status: 401 });

    const { request } = context;
    await ensureSchema(env);
    const sql = getDb(env);

    const requestBody = (await request.json()) as SendEmailRequestBody;
    const rawInlineImages = Array.isArray(requestBody.inlineImages)
      ? requestBody.inlineImages
      : [];
    const inlineImages: InlineEmailImageInput[] = rawInlineImages
      .filter((image: unknown): image is Record<string, unknown> => {
        return typeof image === "object" && image !== null;
      })
      .map((image) => ({
        id: typeof image.id === "string" ? image.id : "",
        filename: typeof image.filename === "string" ? image.filename : "email-image.jpg",
        contentType: typeof image.contentType === "string" ? image.contentType : "",
        contentBase64: typeof image.contentBase64 === "string" ? image.contentBase64 : "",
        size: typeof image.size === "number" ? image.size : undefined,
      }));
    const rawFileAttachments = Array.isArray(requestBody.fileAttachments)
      ? requestBody.fileAttachments
      : [];
    const fileAttachments: EmailFileAttachmentInput[] = rawFileAttachments
      .filter((file: unknown): file is Record<string, unknown> => {
        return typeof file === "object" && file !== null;
      })
      .map((file) => ({
        id: typeof file.id === "string" ? file.id : `email-file-${crypto.randomUUID()}`,
        filename: typeof file.filename === "string" ? file.filename : "attachment",
        contentType: typeof file.contentType === "string" ? file.contentType : "",
        contentBase64: typeof file.contentBase64 === "string" ? file.contentBase64 : "",
        size: typeof file.size === "number" ? file.size : undefined,
      }));
    const to = typeof requestBody.to === "string" ? requestBody.to.trim() : "";
    const subject = typeof requestBody.subject === "string" ? requestBody.subject.trim() : "";
    const emailBody = typeof requestBody.body === "string" ? requestBody.body : "";
    const inReplyToId = typeof requestBody.inReplyToId === "string"
      ? requestBody.inReplyToId
      : "";
    const requestId = typeof requestBody.requestId === "string"
      ? requestBody.requestId.trim()
      : "";
    const referencedInlineImages = filterReferencedInlineImages(emailBody, inlineImages);

    if (!to || !subject || !emailBody) {
      return Response.json(
        { error: "To, subject and body are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return Response.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    if (requestId && !/^[a-zA-Z0-9._:-]{1,200}$/.test(requestId)) {
      return Response.json(
        { error: "Invalid email request id" },
        { status: 400 }
      );
    }

    let replyHeaders: Record<string, string> | undefined = undefined;
    if (inReplyToId) {
      const inboundResult = await sql.query(
        `SELECT message_id FROM inbound_emails WHERE id = $1`,
        [inReplyToId]
      );
      const messageId = inboundResult[0]?.message_id;
      if (messageId) {
        replyHeaders = {
          "In-Reply-To": messageId,
          References: messageId,
        };
      }
    }

    const result = await sendEmail(env, {
      to,
      subject,
      html: emailBody,
      headers: replyHeaders,
      inlineImages: referencedInlineImages,
      fileAttachments,
      idempotencyKey: requestId ? `admin-email/${requestId}` : undefined,
    });

    const existingRows = await sql.query(
      `SELECT id FROM sent_emails WHERE resend_id = $1 LIMIT 1`,
      [result.resendId]
    );
    const existingId = typeof existingRows[0]?.id === "string" ? existingRows[0].id : "";
    if (existingId) {
      return Response.json({ ok: true, id: existingId, resendId: result.resendId });
    }

    const storedAttachments = await storeSentEmailAttachments(
      env.MEDIA_BUCKET,
      result.id,
      referencedInlineImages,
      fileAttachments
    );

    try {
      const savedRows = await sql.query(
        `INSERT INTO sent_emails (
           id, to_address, from_address, subject, body, attachments_json,
           resend_id, in_reply_to_inbound_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (resend_id) WHERE resend_id <> ''
         DO UPDATE SET resend_id = EXCLUDED.resend_id
         RETURNING id`,
        [
          result.id,
          to,
          "sales@tahinspare.com",
          subject,
          emailBody,
          JSON.stringify(storedAttachments),
          result.resendId,
          inReplyToId,
        ]
      );
      const id = typeof savedRows[0]?.id === "string" ? savedRows[0].id : result.id;

      if (id !== result.id) {
        await deleteStoredSentEmailAttachments(env.MEDIA_BUCKET, storedAttachments);
      }

      return Response.json({ ok: true, id, resendId: result.resendId });
    } catch (error) {
      await deleteStoredSentEmailAttachments(env.MEDIA_BUCKET, storedAttachments);
      throw error;
    }
  } catch (error) {
    console.error("Send email error:", error);
    const message = error instanceof Error ? error.message : "Failed to send email";
    return Response.json({ error: message }, { status: 502 });
  }
};
