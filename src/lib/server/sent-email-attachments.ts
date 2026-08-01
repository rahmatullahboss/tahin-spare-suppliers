import type {
  EmailFileAttachmentInput,
  InlineEmailImageInput,
} from "./email-service";

export type StoredSentAttachment = {
  id: string;
  filename: string;
  contentType: string;
  contentDisposition: "inline" | "attachment";
  contentId: string;
  storageKey: string;
};

function safeSegment(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
  return cleaned || fallback;
}

function decodeBase64(contentBase64: string): Uint8Array {
  const normalized = contentBase64.replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function buildStoredSentAttachmentManifest(
  emailId: string,
  inlineImages: InlineEmailImageInput[] = [],
  fileAttachments: EmailFileAttachmentInput[] = []
): StoredSentAttachment[] {
  const safeEmailId = safeSegment(emailId, "email");
  const manifest: StoredSentAttachment[] = [];

  inlineImages.forEach((image, index) => {
    const id = safeSegment(image.id, `email-image-${index + 1}`);
    manifest.push({
      id,
      filename: image.filename || "email-image.jpg",
      contentType: image.contentType || "application/octet-stream",
      contentDisposition: "inline",
      contentId: image.id,
      storageKey: `email/sent/${safeEmailId}/${id}`,
    });
  });

  fileAttachments.forEach((file, index) => {
    const id = safeSegment(file.id ?? "", `email-file-${index + 1}`);
    manifest.push({
      id,
      filename: file.filename || "attachment",
      contentType: file.contentType || "application/octet-stream",
      contentDisposition: "attachment",
      contentId: "",
      storageKey: `email/sent/${safeEmailId}/${id}`,
    });
  });

  return manifest;
}

function isStoredSentAttachment(value: unknown): value is StoredSentAttachment {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id) return false;
  if (typeof item.filename !== "string" || !item.filename) return false;
  if (typeof item.contentType !== "string" || !item.contentType) return false;
  if (item.contentDisposition !== "inline" && item.contentDisposition !== "attachment") return false;
  if (typeof item.contentId !== "string") return false;
  if (typeof item.storageKey !== "string") return false;
  if (!/^email\/sent\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(item.storageKey)) return false;
  if (item.storageKey.includes("..")) return false;
  return true;
}

export function parseStoredSentAttachments(value: unknown): StoredSentAttachment[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredSentAttachment);
  } catch {
    return [];
  }
}

export async function deleteStoredSentEmailAttachments(
  bucket: R2Bucket,
  attachments: StoredSentAttachment[]
): Promise<void> {
  await Promise.allSettled(attachments.map((attachment) => bucket.delete(attachment.storageKey)));
}

export async function storeSentEmailAttachments(
  bucket: R2Bucket,
  emailId: string,
  inlineImages: InlineEmailImageInput[] = [],
  fileAttachments: EmailFileAttachmentInput[] = []
): Promise<StoredSentAttachment[]> {
  const manifest = buildStoredSentAttachmentManifest(emailId, inlineImages, fileAttachments);
  const sourceById = new Map<string, string>();

  inlineImages.forEach((image, index) => {
    const id = safeSegment(image.id, `email-image-${index + 1}`);
    sourceById.set(id, image.contentBase64);
  });
  fileAttachments.forEach((file, index) => {
    const id = safeSegment(file.id ?? "", `email-file-${index + 1}`);
    sourceById.set(id, file.contentBase64);
  });

  const stored: StoredSentAttachment[] = [];
  try {
    for (const attachment of manifest) {
      const base64 = sourceById.get(attachment.id) ?? "";
      if (!base64) throw new Error(`Attachment content is missing for ${attachment.filename}.`);
      const bytes = decodeBase64(base64);
      await bucket.put(attachment.storageKey, bytes, {
        httpMetadata: { contentType: attachment.contentType },
        customMetadata: {
          disposition: attachment.contentDisposition,
          contentId: attachment.contentId,
          filename: attachment.filename,
        },
      });
      stored.push(attachment);
    }
    return manifest;
  } catch (error) {
    await deleteStoredSentEmailAttachments(bucket, stored);
    throw error;
  }
}
