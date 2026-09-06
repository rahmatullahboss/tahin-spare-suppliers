import type { APIRoute } from "astro";
import { readJson, requireAdminRequest } from "../../../lib/server/api";
import { getEmailSignatureSettings, saveEmailSignatureSettings } from "../../../lib/server/email-signature";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return new Response("Unauthorized", { status: 401 });

  try {
    return Response.json({ settings: await getEmailSignatureSettings(env) });
  } catch {
    return Response.json({ error: "Failed to load email signature." }, { status: 500 });
  }
};

export const PUT: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return new Response("Unauthorized", { status: 401 });

  try {
    const body = await readJson<{ settings?: unknown }>(context.request);
    return Response.json({ settings: await saveEmailSignatureSettings(env, body.settings) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save email signature.";
    return Response.json({ error: message }, { status: /Invalid JSON/.test(message) ? 400 : 500 });
  }
};
