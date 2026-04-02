import type { APIRoute } from "astro";
import { requireAdmin } from "./auth";
import { createContent, deleteContent, listContent, updateContent, type ContentType } from "./repository";
import { getRuntimeEnv } from "./env";

export async function readJson<T>(request: Request) {
  return request.json() as Promise<T>;
}

export async function requireAdminRequest(context: Parameters<APIRoute>[0]) {
  const env = getRuntimeEnv(context.locals);
  try {
    await requireAdmin(context.cookies, env.SESSION_SECRET);
  } catch {
    return null;
  }
  return env;
}

export function createListHandler(type: ContentType): APIRoute {
  return async (context) => {
    if (context.request.method === "GET") {
      const env = getRuntimeEnv(context.locals);
      const items = await listContent(env, type);
      return Response.json({ items });
    }

    const env = await requireAdminRequest(context);
    if (!env) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await readJson<{
      title: string;
      excerpt?: string;
      content?: string;
      imageUrl?: string;
      slug?: string;
    }>(context.request);
    const item = await createContent(env, type, body);
    return Response.json({ item });
  };
}

export function createDetailHandler(type: ContentType): APIRoute {
  return async (context) => {
    const env = await requireAdminRequest(context);
    if (!env) {
      return new Response("Unauthorized", { status: 401 });
    }
    const id = context.params.id;

    if (!id) {
      return new Response("Missing id", { status: 400 });
    }

    if (context.request.method === "DELETE") {
      await deleteContent(env, type, id);
      return Response.json({ ok: true });
    }

    const body = await readJson<{
      title: string;
      excerpt?: string;
      content?: string;
      imageUrl?: string;
      slug?: string;
    }>(context.request);
    const item = await updateContent(env, type, id, body);
    return Response.json({ item });
  };
}
