import type { APIRoute } from "astro";
import { requireAdminRequest } from "../../lib/server/api";

const ALLOWED_TYPES = new Set(["image/webp", "image/jpeg", "image/png", "image/gif"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const EXTENSION_MAP: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
};

export const POST: APIRoute = async (context) => {
  try {
    const env = await requireAdminRequest(context);
    if (!env) {
      return new Response("Unauthorized", { status: 401 });
    }
    const formData = await context.request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "Missing file." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 });
    }

    const contentType = file.type || "application/octet-stream";
    if (!ALLOWED_TYPES.has(contentType)) {
      return Response.json({ error: "Invalid file type. Only WebP, JPEG, PNG and GIF are allowed." }, { status: 400 });
    }

    const extension = EXTENSION_MAP[contentType] ?? "bin";
    const objectKey = `uploads/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    await env.MEDIA_BUCKET.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType }
    });

    const publicUrl = `${env.MEDIA_PUBLIC_URL.replace(/\/$/, "")}/${objectKey}`;
    return Response.json({ url: publicUrl, key: objectKey });
  } catch {
    return Response.json({ error: "Upload failed." }, { status: 500 });
  }
};
