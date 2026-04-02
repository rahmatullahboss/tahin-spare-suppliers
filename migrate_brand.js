import { Client } from '@neondatabase/serverless';

const client = new Client("postgresql://neondb_owner:npg_g1BzjrFOs6fb@ep-still-art-a13w46vz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require");
await client.connect();

await client.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS model_number TEXT NOT NULL DEFAULT '';
`);

console.log("Migration for brand and model applied!");
await client.end();
