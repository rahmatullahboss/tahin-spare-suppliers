import type { AstroCookies } from "astro";

const SESSION_COOKIE = "tahin_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function toBase64Url(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toBase64Url(signature);
}

export async function createSessionToken(secret: string) {
  const payload = JSON.stringify({
    role: "admin",
    ts: Date.now()
  });
  const encodedPayload = toBase64Url(new TextEncoder().encode(payload));
  const signature = await signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string, secret: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = await signValue(payload, secret);
  return signature === expectedSignature;
}

export async function isAuthenticated(cookies: AstroCookies, secret: string) {
  const token = cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return false;
  }

  return verifySessionToken(token, secret);
}

export async function setSessionCookie(cookies: AstroCookies, secret: string) {
  const token = await createSessionToken(secret);

  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
    maxAge: SESSION_MAX_AGE
  });
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, {
    path: "/"
  });
}
