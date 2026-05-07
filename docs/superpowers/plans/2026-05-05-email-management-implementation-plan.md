# Email Management System Implementation Plan

**Goal:** Build admin email management system with send/view/receive capabilities using Resend API

**Architecture:** Astro 6 server endpoints + Resend API + Neon PostgreSQL. Email sending uses custom domain `contact@tahinspare.com`, incoming emails received via webhooks and forwarded to notification email.

**Tech Stack:** Astro 6, Resend SDK, Neon PostgreSQL, Cloudflare Workers

---

## File Structure

```
src/
├── pages/
│   ├── admin/
│   │   └── emails.astro              (email dashboard - list sent emails)
│   ├── admin/emails/
│   │   ├── send.astro               (compose email form)
│   │   └── [id].astro               (view single email)
│   ├── api/admin/emails/
│   │   ├── index.ts                 (GET list, POST send)
│   │   └── [id].ts                  (GET single email)
│   └── api/webhooks/resend/
│       └── inbound.ts               (POST - receive inbound emails)
├── lib/server/
│   └── email.ts                     (Resend helper functions)
```

**Database Changes:**
- Modify: `src/lib/server/schema.sql` (add new tables)

---

## Task 1: Update Database Schema

**Files:**
- Modify: `src/lib/server/schema.sql`

Add these tables to the schema:

```sql
CREATE TABLE IF NOT EXISTS sent_emails (
  id TEXT PRIMARY KEY,
  to_address TEXT NOT NULL,
  from_address TEXT NOT NULL DEFAULT 'contact@tahinspare.com',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  resend_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inbound_emails (
  id TEXT PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sent_emails_created ON sent_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_created ON inbound_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_read ON inbound_emails(is_read);
```

---

## Task 2: Create Email Helper Library

**Files:**
- Create: `src/lib/server/email.ts`

```typescript
import { Resend } from "resend";
import type { RuntimeEnv } from "./env";

export interface EmailResult {
  id: string;
  resendId: string;
}

export function getResendClient(env: RuntimeEnv): Resend {
  return new Resend(env.RESEND_API_KEY);
}

export async function sendEmail(
  env: RuntimeEnv,
  to: string,
  subject: string,
  body: string
): Promise<EmailResult> {
  const resend = getResendClient(env);
  const result = await resend.emails.send({
    from: `Tahin Spare Suppliers <contact@tahinspare.com>`,
    to: [to],
    subject,
    html: body,
  });

  return {
    id: crypto.randomUUID(),
    resendId: result.data?.id ?? "",
  };
}

export async function forwardInboundEmail(
  env: RuntimeEnv,
  from: string,
  originalSubject: string,
  body: string,
  toEmail: string = "tahinship@gmail.com"
): Promise<void> {
  const resend = getResendClient(env);
  await resend.emails.send({
    from: `Tahin Spare Suppliers <contact@tahinspare.com>`,
    to: [toEmail],
    subject: `[Forwarded] ${originalSubject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #c0392b; padding: 20px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">New Email Received</h1>
        </div>
        <div style="padding: 25px; background: #f9f9f9;">
          <p><strong>From:</strong> ${from}</p>
          <p><strong>Subject:</strong> ${originalSubject}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <div style="white-space: pre-wrap;">${body}</div>
        </div>
        <div style="padding: 15px; text-align: center; font-size: 12px; color: #999;">
          Reply to this email at: contact@tahinspare.com
        </div>
      </div>
    `,
    replyTo: "contact@tahinspare.com",
  });
}
```

---

## Task 3: Create API - Send Email & List Emails

**Files:**
- Create: `src/pages/api/admin/emails/index.ts`

```typescript
import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../lib/server/env";
import { ensureSchema, getDb } from "../../../lib/server/db";
import { sendEmail } from "../../../lib/server/email";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const env = getRuntimeEnv(Astro.locals);
    await ensureSchema(env);
    const sql = getDb(env);

    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const search = url.searchParams.get("search") ?? "";
    const offset = (page - 1) * limit;

    let query = `SELECT id, to_address, subject, created_at FROM sent_emails`;
    let countQuery = `SELECT COUNT(*) as total FROM sent_emails`;
    const params: any[] = [];

    if (search) {
      query += ` WHERE to_address ILIKE $1 OR subject ILIKE $1`;
      countQuery += ` WHERE to_address ILIKE $1 OR subject ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [emailsResult, countResult] = await Promise.all([
      sql.query(query, params),
      sql.query(countQuery, search ? [`%${search}%`] : []),
    ]);

    const total = countResult[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return Response.json({
      emails: emailsResult,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    console.error("List emails error:", error);
    return Response.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const env = getRuntimeEnv(Astro.locals);
    await ensureSchema(env);
    const sql = getDb(env);

    const body = await request.json();
    const { to, subject, body: emailBody } = body;

    if (!to || !subject || !emailBody) {
      return Response.json(
        { error: "To, subject and body are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return Response.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const result = await sendEmail(env, to, subject, emailBody);
    const id = result.id;

    await sql.query(
      `INSERT INTO sent_emails (id, to_address, from_address, subject, body, resend_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, to, "contact@tahinspare.com", subject, emailBody, result.resendId]
    );

    return Response.json({ ok: true, id, resendId: result.resendId });
  } catch (error) {
    console.error("Send email error:", error);
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
};
```

---

## Task 4: Create API - Get Single Email

**Files:**
- Create: `src/pages/api/admin/emails/[id].ts`

```typescript
import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../lib/server/env";
import { ensureSchema, getDb } from "../../../lib/server/db";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const env = getRuntimeEnv(Astro.locals);
    await ensureSchema(env);
    const sql = getDb(env);

    const { id } = params;
    const result = await sql.query(
      `SELECT id, to_address, from_address, subject, body, created_at
       FROM sent_emails WHERE id = $1`,
      [id]
    );

    if (result.length === 0) {
      return Response.json({ error: "Email not found" }, { status: 404 });
    }

    return Response.json(result[0]);
  } catch (error) {
    console.error("Get email error:", error);
    return Response.json({ error: "Failed to fetch email" }, { status: 500 });
  }
};
```

---

## Task 5: Create API - Inbound Webhook

**Files:**
- Create: `src/pages/api/webhooks/resend/inbound.ts`

```typescript
import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../../lib/server/env";
import { ensureSchema, getDb } from "../../../../lib/server/db";
import { forwardInboundEmail } from "../../../../lib/server/email";

export const prerender = false;

interface ResendWebhookPayload {
  type: string;
  email?: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const env = getRuntimeEnv(Astro.locals);
    await ensureSchema(env);
    const sql = getDb(env);

    const payload: ResendWebhookPayload = await request.json();

    if (payload.type !== "email.received" || !payload.email) {
      return new Response("OK", { status: 200 });
    }

    const { from, to, subject, text, html } = payload.email;
    const body = text ?? html ?? "";
    const id = crypto.randomUUID();

    await sql.query(
      `INSERT INTO inbound_emails (id, from_address, to_address, subject, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, from, to, subject, body]
    );

    await forwardInboundEmail(env, from, subject, body);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("OK", { status: 200 });
  }
};
```

---

## Task 6: Create Admin Email Dashboard Page

**Files:**
- Create: `src/pages/admin/emails.astro`

Full page with:
- Header with "Sent Emails" title and count
- Search bar
- Table listing emails (date, to, subject)
- Pagination
- Client-side JS for loading, searching, pagination

---

## Task 7: Create Compose Email Page

**Files:**
- Create: `src/pages/admin/emails/send.astro`

Form with:
- To (email input)
- Subject (text input)
- Body (textarea)
- Send and Cancel buttons
- Success/error message display

---

## Task 8: Create Email Details Page

**Files:**
- Create: `src/pages/admin/emails/[id].astro`

Display:
- Back link
- Email metadata (from, to, date, subject)
- Email body content

---

## Task 9: Update AdminSidebar

**Files:**
- Modify: `src/components/admin/AdminSidebar.astro`

Add `emails` to active type and navigation link.

---

## Task 10: Update AdminLayout

**Files:**
- Modify: `src/layouts/AdminLayout.astro`

Update Props interface to include `emails` in active type.

---

## Task 11: Update .dev.vars

Add:
```
RESEND_API_KEY="re_your_api_key_here"
RESEND_DOMAIN="tahinspare.com"
NOTIFICATION_EMAIL="tahinship@gmail.com"
```

---

## Resend Configuration Steps

### Step 1: Add Domain
1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter `tahinspare.com`
4. Add DNS records Resend provides

### Step 2: Enable Receiving
1. Resend Dashboard → Domains → `tahinspare.com`
2. Find "Receiving" section
3. Enable and add webhook URL: `https://tahinspare.com/api/webhooks/resend/inbound`
4. Select events: `email.received`

### Step 3: Get API Key
1. Go to https://resend.com/api-keys
2. Create new API key
3. Add to `.dev.vars`

---

## Implementation Order

1. Task 1 - Update schema.sql
2. Task 2 - Create email.ts helper
3. Task 3 - Create emails API (GET/POST list)
4. Task 4 - Create single email API
5. Task 5 - Create webhook API
6. Task 6 - Create emails dashboard page
7. Task 7 - Create compose email page
8. Task 8 - Create email details page
9. Task 9 - Update AdminSidebar
10. Task 10 - Update AdminLayout
11. Task 11 - Update .dev.vars
