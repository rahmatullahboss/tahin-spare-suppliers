import type { APIRoute } from "astro";
import { logoutAdmin } from "../../../lib/server/auth";

export const POST: APIRoute = async ({ cookies }) => {
  logoutAdmin(cookies);
  return Response.json({ ok: true });
};
