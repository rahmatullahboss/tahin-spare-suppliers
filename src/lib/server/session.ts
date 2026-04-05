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

  // Check token expiry from payload
  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof decoded.ts === "number" && Date.now() - decoded.ts > SESSION_MAX_AGE * 1000) {
      return false;
    }
  } catch {
    return false;
  }

  const expectedSignature = await signValue(payload, secret);

  // Constant-time comparison
  const encoder = new TextEncoder();
  const a = encoder.encode(signature);
  const b = encoder.encode(expectedSignature);

  if (a.byteLength !== b.byteLength) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    a,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, b));
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, a));

  if (mac.byteLength !== expected.byteLength) return false;

  let result = 0;
  for (let i = 0; i < mac.byteLength; i++) {
    result |= mac[i] ^ expected[i];
  }
  return result === 0;
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
