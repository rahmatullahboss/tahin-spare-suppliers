/// <reference types="astro/client" />

declare module 'cloudflare:workers' {
  export const env: any;
}

type RuntimeEnv = {
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
  BING_SITE_VERIFICATION?: string;
  INDEXNOW_KEY?: string;
  INVENTORY_VERIFICATION_MAX_AGE_DAYS?: string;
};

declare namespace App {
  interface Locals {
    runtime: {
      env: RuntimeEnv;
    };
  }
}
