import type { APIRoute } from "astro";
import { readJson, requireAdminRequest } from "../../../lib/server/api";
import { reorderCategories, saveCategoryPresentation } from "../../../lib/server/categories";

export const prerender = false;

type PresentationBody = {
  slug?: string;
  label?: string;
  imageUrl?: string;
  imageKey?: string;
  orderedSlugs?: string[];
};

export const PUT: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await readJson<PresentationBody>(context.request);
    const slug = body.slug?.trim() ?? "";
    if (!slug) return Response.json({ error: "Category slug is required" }, { status: 400 });

    const category = await saveCategoryPresentation(env, slug, {
      label: body.label ?? "",
      imageUrl: body.imageUrl ?? "",
      imageKey: body.imageKey ?? "",
    });
    return Response.json({ category });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save category presentation";
    const status = /not found|required|invalid/i.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
};

export const PATCH: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await readJson<PresentationBody>(context.request);
    if (!Array.isArray(body.orderedSlugs)) {
      return Response.json({ error: "orderedSlugs is required" }, { status: 400 });
    }
    const categories = await reorderCategories(env, body.orderedSlugs);
    return Response.json({ categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reorder categories";
    return Response.json({ error: message }, { status: 400 });
  }
};
