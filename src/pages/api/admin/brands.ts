import type { APIRoute } from "astro";
import { readJson, requireAdminRequest } from "../../../lib/server/api";
import { createBrand, deleteBrand, listBrands, updateBrand } from "../../../lib/server/brands";

type BrandBody = {
  id?: string;
  name?: string;
  logoUrl?: string;
  logoKey?: string;
};

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && /duplicate key|unique constraint/i.test(error.message);
}

function getBrandInput(body: BrandBody) {
  return {
    name: body.name ?? "",
    logoUrl: body.logoUrl ?? "",
    logoKey: body.logoKey ?? ""
  };
}

export const GET: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return Response.json(await listBrands(env));
  } catch {
    return Response.json({ error: "Failed to fetch brands" }, { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await readJson<BrandBody>(context.request);
    return Response.json(await createBrand(env, getBrandInput(body)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create brand";
    if (message === "Invalid JSON body" || message === "Name is required" || message === "Name must contain at least one letter or number") {
      return Response.json({ error: message }, { status: 400 });
    }
    if (isUniqueConstraintError(error)) {
      return Response.json({ error: "A brand with this name already exists" }, { status: 409 });
    }
    return Response.json({ error: "Failed to create brand" }, { status: 500 });
  }
};

export const PUT: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await readJson<BrandBody>(context.request);
    const id = body.id?.trim();
    if (!id) return Response.json({ error: "ID is required" }, { status: 400 });

    const brand = await updateBrand(env, id, getBrandInput(body));
    if (!brand) return Response.json({ error: "Brand not found" }, { status: 404 });
    return Response.json(brand);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update brand";
    if (
      message === "Invalid JSON body"
      || message === "Name is required"
      || message === "Name must contain at least one letter or number"
      || message === "A brand with this name already exists"
    ) {
      return Response.json({ error: message }, { status: 400 });
    }
    if (isUniqueConstraintError(error)) {
      return Response.json({ error: "A brand with this name already exists" }, { status: 409 });
    }
    return Response.json({ error: "Failed to update brand" }, { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const env = await requireAdminRequest(context);
  if (!env) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await readJson<BrandBody>(context.request);
    const id = body.id?.trim();
    if (!id) return Response.json({ error: "ID is required" }, { status: 400 });

    const brand = await deleteBrand(env, id);
    if (!brand) return Response.json({ error: "Brand not found" }, { status: 404 });

    if (brand.logoKey) {
      try {
        await env.MEDIA_BUCKET.delete(brand.logoKey);
      } catch (error) {
        console.error("Failed to delete brand logo", brand.logoKey, error);
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete brand";
    if (message === "Invalid JSON body") return Response.json({ error: message }, { status: 400 });
    if (message.startsWith("Cannot delete ")) return Response.json({ error: message }, { status: 409 });
    return Response.json({ error: "Failed to delete brand" }, { status: 500 });
  }
};
