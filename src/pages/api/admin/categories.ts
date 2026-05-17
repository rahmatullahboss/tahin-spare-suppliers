import type { APIRoute } from "astro";
import { readJson, requireAdminRequest } from "../../../lib/server/api";
import {
  createCustomCategory,
  deleteCustomCategory,
  listCustomCategories,
  updateCustomCategory
} from "../../../lib/server/categories";

type CategoryBody = {
  id?: string;
  name?: string;
  imageUrl?: string;
  imageKey?: string;
  parentId?: string;
};

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && /duplicate key|unique constraint/i.test(error.message);
}

function getCategoryInput(body: CategoryBody) {
  return {
    name: body.name ?? "",
    imageUrl: body.imageUrl ?? "",
    imageKey: body.imageKey ?? "",
    parentId: body.parentId ?? ""
  };
}

export const GET: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const categories = await listCustomCategories(env);
    return Response.json(categories);
  } catch {
    return Response.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await readJson<CategoryBody>(context.request);
    const category = await createCustomCategory(env, getCategoryInput(body));
    return Response.json(category);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create category";
    if (message === "Invalid JSON body" || message === "Name is required" || message === "Name must contain at least one letter or number" || message === "Default category names are reserved") {
      return Response.json({ error: message }, { status: 400 });
    }
    if (isUniqueConstraintError(error)) {
      return Response.json({ error: "A category with this name or slug already exists" }, { status: 409 });
    }
    return Response.json({ error: "Failed to create category" }, { status: 500 });
  }
};

export const PUT: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await readJson<CategoryBody>(context.request);
    const id = body.id?.trim();
    if (!id) {
      return Response.json({ error: "ID is required" }, { status: 400 });
    }

    const category = await updateCustomCategory(env, id, getCategoryInput(body));
    if (!category) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    return Response.json(category);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update category";
    if (message === "Invalid JSON body" || message === "Name is required" || message === "Name must contain at least one letter or number" || message === "Default category names are reserved") {
      return Response.json({ error: message }, { status: 400 });
    }
    if (isUniqueConstraintError(error)) {
      return Response.json({ error: "A category with this name or slug already exists" }, { status: 409 });
    }
    return Response.json({ error: "Failed to update category" }, { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await readJson<CategoryBody>(context.request);
    const id = body.id?.trim();
    if (!id) {
      return Response.json({ error: "ID is required" }, { status: 400 });
    }

    const deletedCategory = await deleteCustomCategory(env, id);
    if (deletedCategory?.imageKey) {
      try {
        await env.MEDIA_BUCKET.delete(deletedCategory.imageKey);
      } catch (error) {
        console.error("Failed to delete category media object", deletedCategory.imageKey, error);
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete category";
    if (message === "Invalid JSON body") {
      return Response.json({ error: message }, { status: 400 });
    }
    return Response.json({ error: "Failed to delete category" }, { status: 500 });
  }
};
