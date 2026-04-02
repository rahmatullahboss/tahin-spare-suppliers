import { env as cfEnv } from 'cloudflare:workers';

export type RuntimeEnv = {
  DATABASE_URL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  MEDIA_PUBLIC_URL: string;
  MEDIA_BUCKET: any; // R2Bucket
};

export function getRuntimeEnv(locals?: any): RuntimeEnv {
  return cfEnv as unknown as RuntimeEnv;
}
