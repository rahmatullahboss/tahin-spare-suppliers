import type { APIRoute } from "astro";
import { requireAdminRequest } from "../../lib/server/api";

export const POST: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) {
    return new Response("Unauthorized", { status: 401 });
  }
  const formData = await context.request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return new Response("Missing file.", { status: 400 });
  }

  const extension = file.name.toLowerCase().endsWith(".webp") ? "webp" : "bin";
  const objectKey = `uploads/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  await env.MEDIA_BUCKET.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "image/webp"
    }
  });

  const publicUrl = `${env.MEDIA_PUBLIC_URL.replace(/\/$/, "")}/${objectKey}`;
  return Response.json({ url: publicUrl, key: objectKey });
};
