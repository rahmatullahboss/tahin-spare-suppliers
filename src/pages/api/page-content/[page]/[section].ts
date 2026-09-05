import type { APIRoute } from "astro";
import { isHomepageSectionKey } from "../../../../lib/page-content";
import { requireAdminRequest, readJson } from "../../../../lib/server/api";
import { getRuntimeEnv } from "../../../../lib/server/env";
import { getHomepageSection, saveHomepageSection } from "../../../../lib/server/page-content";

export const GET: APIRoute = async (context) => {
  const page = context.params.page ?? "";
  const section = context.params.section ?? "";
  if (page !== "home" || !isHomepageSectionKey(section)) {
    return Response.json({ error: "Unknown page section." }, { status: 404 });
  }

  try {
    const env = getRuntimeEnv(context.locals);
    const content = await getHomepageSection(env, section);
    return Response.json({ content });
  } catch {
    return Response.json({ error: "Failed to load section." }, { status: 500 });
  }
};

export const PUT: APIRoute = async (context) => {
  const page = context.params.page ?? "";
  const section = context.params.section ?? "";
  if (page !== "home" || !isHomepageSectionKey(section)) {
    return Response.json({ error: "Unknown page section." }, { status: 404 });
  }

  const env = await requireAdminRequest(context);
  if (!env) return new Response("Unauthorized", { status: 401 });

  try {
    const body = await readJson<{ content?: unknown }>(context.request);
    const content = await saveHomepageSection(env, section, body.content);
    return Response.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save section.";
    const status = /too large|must be an object|Invalid JSON/.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
};
