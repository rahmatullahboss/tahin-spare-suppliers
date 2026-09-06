import type { APIRoute } from "astro";
import { readJson, requireAdminRequest } from "../../lib/server/api";
import { getRuntimeEnv } from "../../lib/server/env";
import { getPageOverrides, savePageOverrides } from "../../lib/server/page-overrides";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const page = context.url.searchParams.get("page") ?? "";
    const env = getRuntimeEnv(context.locals);
    return Response.json({ overrides: await getPageOverrides(env, page) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load page edits.";
    return Response.json({ error: message }, { status: /Invalid page/.test(message) ? 400 : 500 });
  }
};

export const PUT: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return new Response("Unauthorized", { status: 401 });

  try {
    const body = await readJson<{ page?: unknown; overrides?: unknown }>(context.request);
    const page = typeof body.page === "string" ? body.page : "";
    const overrides = await savePageOverrides(env, page, body.overrides);
    return Response.json({ overrides });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save page edits.";
    const status = /Invalid page|must be an object|too large|Invalid JSON/.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
};
