import { env as cfEnv } from 'cloudflare:workers';

export type RuntimeEnv = {
  DATABASE_URL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  MEDIA_PUBLIC_URL: string;
  MEDIA_BUCKET: any; // R2Bucket
};

export function getRuntimeEnv(locals?: any): RuntimeEnv {
  let envToUse: any = undefined;
  try {
    if (locals && locals.runtime && locals.runtime.env) {
      envToUse = locals.runtime.env;
    }
  } catch (e) {
    // Safely ignore getter errors
  }
  const env = envToUse ?? cfEnv;
  return env as unknown as RuntimeEnv;
}
