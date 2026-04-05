import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../lib/server/env";
import { loginAdmin } from "../../../lib/server/auth";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  record.count++;
  return record.count <= MAX_ATTEMPTS;
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
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
  } catch {
    return new Response("Internal server error.", { status: 500 });
  }
};
