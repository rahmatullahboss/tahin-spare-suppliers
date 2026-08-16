import { env as cfEnv } from 'cloudflare:workers';

export type RuntimeEnv = {
  DATABASE_URL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  MEDIA_PUBLIC_URL: string;
  MEDIA_BUCKET: R2Bucket;
  RESEND_API_KEY: string;
  RESEND_WEBHOOK_SECRET: string;
  NOTIFICATION_EMAIL?: string;
  GOOGLE_ANALYTICS_ID?: string;
  GOOGLE_SITE_VERIFICATION?: string;
};

export function getRuntimeEnv(locals?: unknown): RuntimeEnv {
  let envToUse: Record<string, unknown> | undefined = undefined;
  try {
    const loc = locals as Record<string, Record<string, Record<string, unknown>>> | undefined;
    if (loc?.runtime?.env) {
      envToUse = loc.runtime.env;
    }
  } catch {
    // Safely ignore getter errors
  }
  const env = envToUse ?? cfEnv;
  return env as unknown as RuntimeEnv;
}
