/// <reference types="astro/client" />

type RuntimeEnv = {
  DATABASE_URL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  MEDIA_PUBLIC_URL: string;
  MEDIA_BUCKET: R2Bucket;
};

declare namespace App {
  interface Locals {
    runtime: {
      env: RuntimeEnv;
    };
  }
}
