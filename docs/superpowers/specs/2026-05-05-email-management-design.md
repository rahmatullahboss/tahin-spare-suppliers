# Email Management System - Design Spec

**Date:** 2026-05-05
**Project:** tahin-spare-suppliers
**Stack:** Astro 6 + Resend API + Cloudflare Workers

---

## Overview

Build an email management system in the admin panel that enables:
1. Sending emails via Resend using custom domain `contact@tahinspare.com`
2. Viewing sent email history
3. Receiving incoming emails via Resend webhooks
4. Auto-forwarding incoming emails to `tahinship@gmail.com`

---

## Architecture

### Tech Stack
- **Framework:** Astro 6 with server endpoints (`export const prerender = false`)
- **Email API:** Resend (resend.com)
- **Database:** Neon PostgreSQL
- **Runtime:** Cloudflare Workers

### Flow Diagram
```
Outgoing:
[Admin Panel] → [POST /api/admin/emails/send] → [Resend API] → [Recipient]
                                                        ↓
                                                   [Save to DB]

Incoming:
[Email to contact@tahinspare.com] → [Resend Webhook] → [POST /api/webhooks/resend/inbound]
                                                                      ↓
                                                               [Save to DB]
                                                                      ↓
                                                               [Forward to tahinship@gmail.com]
```

---

## Database Schema

### New Tables

```sql
-- Log of all sent emails
CREATE TABLE sent_emails (
  id TEXT PRIMARY KEY,
  to_address TEXT NOT NULL,
  from_address TEXT NOT NULL DEFAULT 'contact@tahinspare.com',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  resend_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store incoming emails received via webhook
CREATE TABLE inbound_emails (
  id TEXT PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sent_emails_created ON sent_emails(created_at DESC);
CREATE INDEX idx_inbound_emails_created ON inbound_emails(created_at DESC);
CREATE INDEX idx_inbound_emails_read ON inbound_emails(is_read);
```

---

## Pages

### 1. `/admin/emails` - Email Dashboard

**Purpose:** List all sent emails with pagination

**Layout:**
```
[Sidebar]
[Header: Emails - Sent (count)]

[Search bar] [Compose Email button]

[Email List Table]
| Date | To | Subject | Status |
|------|-----|---------|--------|
| ...  | ... | ...    | ...    |

[Pagination]
```

**Features:**
- List sent emails (newest first)
- Search by recipient or subject
- Pagination (20 per page)
- Click row to view email details
- "Compose Email" button → `/admin/emails/send`

### 2. `/admin/emails/send` - Compose Email

**Purpose:** Send new email via Resend

**Form Fields:**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| To | email input | Yes | Valid email format |
| Subject | text | Yes | Max 200 chars |
| Body | textarea | Yes | Max 50,000 chars |

**Actions:**
- Send → POST to API → Show success/error
- Cancel → Return to `/admin/emails`

### 3. `/admin/emails/[id]` - Email Details

**Purpose:** View single email details

**Display:**
```
[Back button]

Email Details
From: contact@tahinspare.com
To: recipient@example.com
Date: May 5, 2026 10:30 AM
Subject: [subject]

---
[Email body content]
```

---

## API Endpoints

### 1. `POST /api/admin/emails/send`

**Purpose:** Send email via Resend and save to DB

**Request Body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Email subject",
  "body": "Email body content"
}
```

**Response (200):**
```json
{
  "ok": true,
  "id": "email_uuid",
  "resendId": "resend_email_id"
}
```

**Response (400):**
```json
{
  "error": "Validation error message"
}
```

**Response (500):**
```json
{
  "error": "Failed to send email"
}
```

### 2. `GET /api/admin/emails`

**Purpose:** List sent emails with pagination

**Query Params:**
- `page` (default: 1)
- `limit` (default: 20)
- `search` (optional)

**Response (200):**
```json
{
  "emails": [...],
  "total": 100,
  "page": 1,
  "totalPages": 5
}
```

### 3. `GET /api/admin/emails/[id]`

**Purpose:** Get single email details

**Response (200):**
```json
{
  "id": "uuid",
  "to_address": "...",
  "from_address": "...",
  "subject": "...",
  "body": "...",
  "created_at": "..."
}
```

**Response (404):**
```json
{
  "error": "Email not found"
}
```

### 4. `POST /api/webhooks/resend/inbound`

**Purpose:** Receive incoming emails from Resend webhook

**Request Body (from Resend):**
```json
{
  "type": "email.received",
  "email": {
    "from": "sender@example.com",
    "to": "contact@tahinspare.com",
    "subject": "...",
    "text": "...",
    "html": "..."
  }
}
```

**Actions:**
1. Save email to `inbound_emails` table
2. Forward to `tahinship@gmail.com` using Resend with Reply-To header

**Response:** `200 OK` (required by Resend)

---

## Environment Variables

Add to `.dev.vars`:
```
RESEND_API_KEY="re_xxxxxxxxxxx"
RESEND_DOMAIN="tahinspare.com"
NOTIFICATION_EMAIL="tahinship@gmail.com"
```

---

## Resend Configuration Steps

### Step 1: Add Domain
1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click "Add Domain"
3. Enter `tahinspare.com`
4. Add the DNS records Resend provides:
   - TXT record for domain verification
   - MX record for email receiving
   - CNAME records for tracking (optional)

### Step 2: Configure Webhook
1. In Resend Dashboard → Domains → `tahinspare.com`
2. Find "Receiving" section
3. Enable receiving
4. Add webhook URL: `https://tahinspare.com/api/webhooks/resend/inbound`
5. Select events: `email.received`

### Step 3: Update .dev.vars
Add your `RESEND_API_KEY` from Resend Dashboard → API Keys

---

## File Structure

```
src/
├── pages/
│   ├── admin/
│   │   └── emails.astro           (redirects to /admin/emails)
│   ├── api/
│   │   ├── admin/
│   │   │   └── emails/
│   │   │       ├── index.ts       (GET list, POST send)
│   │   │       └── [id].ts        (GET single)
│   │   └── webhooks/
│   │       └── resend/
│   │           └── inbound.ts     (POST receive)
├── lib/
│   └── server/
│       └── email.ts               (Resend helper functions)
```

---

## Security Considerations

1. **Admin Authentication:** All `/admin/emails/*` pages require authentication (existing `isAuthenticated` check)
2. **Webhook Verification:** Validate webhook signature from Resend (optional but recommended)
3. **Input Validation:** Sanitize all user inputs before sending
4. **Rate Limiting:** Consider adding rate limits for email sending

---

## Testing Checklist

- [ ] Send email from admin → verify delivered
- [ ] View sent email in admin panel
- [ ] Contact form submission → notification email received
- [ ] Email to `contact@tahinspare.com` → saved in DB + forwarded
- [ ] Pagination works correctly
- [ ] Search functionality works