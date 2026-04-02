import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../lib/server/env";
import { loginAdmin } from "../../../lib/server/auth";

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const env = getRuntimeEnv(locals);
  const { password } = await request.json() as { password?: string };

  if (!password) {
    return new Response("Password is required.", { status: 400 });
  }

  const authenticated = await loginAdmin(cookies, password, env.ADMIN_PASSWORD, env.SESSION_SECRET);

  if (!authenticated) {
    return new Response("Invalid password.", { status: 401 });
  }

  return Response.json({ ok: true });
};
