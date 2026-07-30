import { Resend } from "resend";
import type {
  Attachment,
  GetReceivingEmailResponseSuccess,
  WebhookEventPayload
} from "resend";
import type { RuntimeEnv } from "./env";

export interface EmailResult {
  id: string;
  resendId: string;
}

export interface InlineEmailImageInput {
  id: string;
  filename: string;
  contentType: string;
  contentBase64: string;
  size?: number;
}

export interface EmailFileAttachmentInput {
  filename: string;
  contentType: string;
  contentBase64: string;
  size?: number;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  inlineImages?: InlineEmailImageInput[];
  fileAttachments?: EmailFileAttachmentInput[];
  idempotencyKey?: string;
}

const ALLOWED_INLINE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);
const MAX_INLINE_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_INLINE_IMAGE_COUNT = 5;
const MAX_FILE_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const MAX_FILE_ATTACHMENT_COUNT = 10;
const MAX_TOTAL_ATTACHMENT_ENCODED_SIZE = 40 * 1024 * 1024;
const DEFAULT_FROM = "Tahin Spare Suppliers <sales@tahinspare.com>";
const DEFAULT_INBOUND_FORWARD_TO = "tahinship@gmail.com";

export function getResendClient(env: RuntimeEnv): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  return new Resend(env.RESEND_API_KEY);
}

function normalizeBase64(contentBase64: string): string {
  return contentBase64.replace(/\s/g, "");
}

function getBase64Bytes(contentBase64: string): number {
  const normalized = normalizeBase64(contentBase64);
  if (
    normalized.length === 0
    || normalized.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  ) {
    throw new Error("Invalid attachment content.");
  }

  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function sanitizeAttachmentFilename(filename: string, fallback: string): string {
  const cleanName = filename.replace(/[^\w.\- ()]/g, "").trim();
  return cleanName || fallback;
}

function getReferencedInlineImageIds(body: string): Set<string> {
  const ids = new Set<string>();
  const cidPattern = /<img\b[^>]*\bsrc=["']cid:([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null = cidPattern.exec(body);

  while (match) {
    try {
      ids.add(decodeURIComponent(match[1]));
    } catch {
      throw new Error("Invalid inline image id.");
    }
    match = cidPattern.exec(body);
  }

  return ids;
}

export function prepareInlineImageAttachments(
  body: string,
  inlineImages: InlineEmailImageInput[] = []
): Attachment[] {
  if (inlineImages.length > MAX_INLINE_IMAGE_COUNT) {
    throw new Error(`Maximum ${MAX_INLINE_IMAGE_COUNT} inline images are allowed.`);
  }

  const referencedIds = getReferencedInlineImageIds(body);
  const attachments: Attachment[] = [];

  for (const image of inlineImages) {
    if (!referencedIds.has(image.id)) continue;

    if (!/^[a-zA-Z0-9._-]{1,128}$/.test(image.id)) {
      throw new Error("Invalid inline image id.");
    }

    if (!ALLOWED_INLINE_IMAGE_TYPES.has(image.contentType)) {
      throw new Error(`Unsupported inline image type: ${image.contentType}`);
    }

    if (!image.contentBase64) {
      throw new Error("Inline image content is missing.");
    }

    const estimatedSize = getBase64Bytes(image.contentBase64);
    if (estimatedSize > MAX_INLINE_IMAGE_SIZE) {
      throw new Error("Inline image is too large. Maximum size is 8MB.");
    }

    attachments.push({
      filename: sanitizeAttachmentFilename(image.filename, `${image.id}.jpg`),
      content: image.contentBase64,
      contentType: image.contentType,
      contentId: image.id
    });
  }

  return attachments;
}

export function prepareFileAttachments(
  fileAttachments: EmailFileAttachmentInput[] = []
): Attachment[] {
  if (fileAttachments.length > MAX_FILE_ATTACHMENT_COUNT) {
    throw new Error(`Maximum ${MAX_FILE_ATTACHMENT_COUNT} files can be attached.`);
  }

  const attachments: Attachment[] = [];

  for (const file of fileAttachments) {
    if (!file.contentBase64) {
      throw new Error("Attachment content is missing.");
    }

    const estimatedSize = getBase64Bytes(file.contentBase64);
    if (estimatedSize > MAX_FILE_ATTACHMENT_SIZE) {
      throw new Error("Attachment is too large. Maximum size is 20MB per file.");
    }

    attachments.push({
      filename: sanitizeAttachmentFilename(file.filename, "attachment"),
      content: file.contentBase64,
      contentType: file.contentType || "application/octet-stream",
    });
  }

  return attachments;
}

export function prepareEmailAttachments(
  body: string,
  inlineImages: InlineEmailImageInput[] = [],
  fileAttachments: EmailFileAttachmentInput[] = []
): Attachment[] {
  const attachments = [
    ...prepareInlineImageAttachments(body, inlineImages),
    ...prepareFileAttachments(fileAttachments)
  ];
  const totalEncodedSize = attachments.reduce((total, attachment) => {
    if (typeof attachment.content !== "string") {
      throw new Error("Invalid attachment content.");
    }

    return total + normalizeBase64(attachment.content).length;
  }, 0);

  if (totalEncodedSize > MAX_TOTAL_ATTACHMENT_ENCODED_SIZE) {
    throw new Error("Attachments are too large. Maximum encoded size is 40MB.");
  }

  return attachments;
}

export async function sendEmail(
  env: RuntimeEnv,
  input: SendEmailInput
): Promise<EmailResult> {
  const resend = getResendClient(env);
  const attachments = prepareEmailAttachments(
    input.html,
    input.inlineImages,
    input.fileAttachments
  );
  const payload = {
    from: input.from ?? DEFAULT_FROM,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
    headers: input.headers,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
  const result = input.idempotencyKey
    ? await resend.emails.send(payload, { idempotencyKey: input.idempotencyKey })
    : await resend.emails.send(payload);

  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message ?? "Resend did not accept the email.");
  }

  return {
    id: crypto.randomUUID(),
    resendId: result.data.id,
  };
}

export async function getReceivedEmail(
  env: RuntimeEnv,
  emailId: string
): Promise<GetReceivingEmailResponseSuccess> {
  const resend = getResendClient(env);
  const result = await resend.emails.receiving.get(emailId);

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Failed to retrieve received email");
  }

  return result.data;
}

export async function getReceivedEmailAttachment(
  env: RuntimeEnv,
  emailId: string,
  attachmentId: string
) {
  const resend = getResendClient(env);
  const result = await resend.emails.receiving.attachments.get({
    emailId,
    id: attachmentId,
  });

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Failed to retrieve received attachment");
  }

  return result.data;
}

export function verifyResendWebhook(
  env: RuntimeEnv,
  payload: string,
  requestHeaders: Headers
): WebhookEventPayload {
  if (!env.RESEND_WEBHOOK_SECRET) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured");
  }

  const resend = getResendClient(env);
  const verificationRequest = {
    payload,
    headers: {
      id: requestHeaders.get("svix-id") ?? "",
      timestamp: requestHeaders.get("svix-timestamp") ?? "",
      signature: requestHeaders.get("svix-signature") ?? "",
    },
    ["webhook" + "Secret"]: env.RESEND_WEBHOOK_SECRET,
  } as Parameters<typeof resend.webhooks.verify>[0];

  return resend.webhooks.verify(verificationRequest);
}

export function buildInboundForwardRequest(
  emailId: string,
  toEmail: string = DEFAULT_INBOUND_FORWARD_TO
) {
  return {
    emailId,
    to: toEmail,
    from: DEFAULT_FROM,
  };
}

export async function forwardInboundEmail(
  env: RuntimeEnv,
  emailId: string,
  toEmail: string = DEFAULT_INBOUND_FORWARD_TO
): Promise<void> {
  const resend = getResendClient(env);
  const result = await resend.emails.receiving.forward(
    buildInboundForwardRequest(emailId, toEmail)
  );

  if (result.error) {
    throw new Error(result.error.message ?? "Failed to forward received email");
  }
}
