import { neon } from "@neondatabase/serverless";
console.log(typeof neon("postgres://user:pass@ep-restless-bird-a58f4a1x-pooler.us-east-2.aws.neon.tech/neondb").query);
