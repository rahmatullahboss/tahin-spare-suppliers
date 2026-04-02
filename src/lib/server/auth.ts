import type { AstroCookies } from "astro";
import { clearSessionCookie, isAuthenticated, setSessionCookie } from "./session";

export async function requireAdmin(cookies: AstroCookies, secret: string) {
  const authenticated = await isAuthenticated(cookies, secret);

  if (!authenticated) {
    throw new Error("Unauthorized");
  }
}

export async function loginAdmin(
  cookies: AstroCookies,
  password: string,
  adminPassword: string,
  sessionSecret: string
) {
  if (password !== adminPassword) {
    return false;
  }

  await setSessionCookie(cookies, sessionSecret);
  return true;
}

export function logoutAdmin(cookies: AstroCookies) {
  clearSessionCookie(cookies);
}
