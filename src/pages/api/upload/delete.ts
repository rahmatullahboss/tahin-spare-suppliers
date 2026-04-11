import type { APIRoute } from "astro";
import { readJson, requireAdminRequest } from "../../../lib/server/api";

export const POST: APIRoute = async (context) => {
  try {
    const env = await requireAdminRequest(context);
    if (!env) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await readJson<{ key?: string }>(context.request);
    const key = body.key?.trim();

    if (!key) {
      return Response.json({ error: "Missing key." }, { status: 400 });
    }

    await env.MEDIA_BUCKET.delete(key);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Delete failed." }, { status: 500 });
  }
};
