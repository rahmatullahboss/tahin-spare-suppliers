import type { APIRoute } from "astro";
import { requireAdmin } from "./auth";
import {
  countContent,
  createContent,
  deleteContent,
  getContentById,
  listContent,
  updateContent,
  type ContentInput,
  type ContentType
} from "./repository";
import { getRuntimeEnv } from "./env";
import { notifyContentChange } from "./indexnow";

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
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

function queueContentChange(
  context: Parameters<APIRoute>[0],
  env: ReturnType<typeof getRuntimeEnv>,
  type: ContentType,
  slugs: Array<string | undefined>,
) {
  const notification = notifyContentChange(env, type, slugs);
  if (context.locals.cfContext?.waitUntil) {
    context.locals.cfContext.waitUntil(notification);
    return;
  }
  void notification;
}

export function createListHandler(type: ContentType): APIRoute {
  return async (context) => {
    try {
      if (context.request.method === "GET") {
        const env = getRuntimeEnv(context.locals);
        const url = new URL(context.request.url);
        const page = parseInt(url.searchParams.get("page") ?? "1", 10);
        const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
        const search = url.searchParams.get("search") ?? undefined;

        const [items, total] = await Promise.all([
          listContent(env, type, { page, limit, search }),
          countContent(env, type, search)
        ]);

        const totalPages = Math.ceil(total / limit);
        return Response.json({ items, total, page, totalPages, limit });
      }

      const env = await requireAdminRequest(context);
      if (!env) {
        return new Response("Unauthorized", { status: 401 });
      }

      const body = await readJson<ContentInput>(context.request);

      if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
        return Response.json({ error: "Title is required." }, { status: 400 });
      }

      const item = await createContent(env, type, body);
      queueContentChange(context, env, type, [item.slug]);
      return Response.json({ item });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      if (message === "Invalid JSON body") {
        return Response.json({ error: message }, { status: 400 });
      }
      return Response.json({ error: "Failed to process request." }, { status: 500 });
    }
  };
}

export function createDetailHandler(type: ContentType): APIRoute {
  return async (context) => {
    try {
      const env = await requireAdminRequest(context);
      if (!env) {
        return new Response("Unauthorized", { status: 401 });
      }
      const id = context.params.id;

      if (!id) {
        return new Response("Missing id", { status: 400 });
      }

      const existingItem = await getContentById(env, type, id);

      if (context.request.method === "DELETE") {
        await deleteContent(env, type, id);

        if (existingItem?.imageKey) {
          try {
            await env.MEDIA_BUCKET.delete(existingItem.imageKey);
          } catch (error) {
            console.error("Failed to delete media object", existingItem.imageKey, error);
          }
        }

        queueContentChange(context, env, type, [existingItem?.slug]);
        return Response.json({ ok: true });
      }

      const body = await readJson<ContentInput>(context.request);

      if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
        return Response.json({ error: "Title is required." }, { status: 400 });
      }

      const item = await updateContent(env, type, id, body);
      queueContentChange(context, env, type, [existingItem?.slug, item.slug]);
      return Response.json({ item });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      if (message === "Invalid JSON body") {
        return Response.json({ error: message }, { status: 400 });
      }
      return Response.json({ error: "Failed to process request." }, { status: 500 });
    }
  };
}
