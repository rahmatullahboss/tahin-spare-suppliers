# Tahin Spare Suppliers Email System

## Architecture

The application uses Resend for outbound delivery and inbound receiving, Cloudflare Workers for API routes and signed webhooks, and Neon Postgres for message state.

- Outbound sender: `Tahin Spare Suppliers <sales@tahinspare.com>`
- Inbound address: `sales@tahinspare.com`
- Notification destination: `NOTIFICATION_EMAIL`, with `tahinship@gmail.com` as the application fallback
- Inbound webhook: `/api/webhooks/resend/inbound`
- Admin email UI: `/admin/emails`

## Required secrets and variables

Configure sensitive values with Cloudflare secrets. Never place secret values in source code, documentation, examples, logs, or committed `.dev.vars` files.

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_WEBHOOK_SECRET
```

Non-sensitive variables may be configured in Wrangler:

- `MEDIA_PUBLIC_URL`
- `NOTIFICATION_EMAIL`

The Resend API key must have the permissions required by both sending and receiving APIs. A sending-only key cannot retrieve or forward received messages.

## Outbound flow

All outbound messages use `src/lib/server/email-service.ts`.

The service provides:

- verified-domain sender identity
- Resend SDK requests rather than hand-built HTTP calls
- idempotency keys for admin, contact, and enquiry messages
- `Reply-To` support
- plain-text alternatives
- provider error propagation for the authenticated admin UI
- inline-image and file-attachment validation
- a 40 MB post-Base64 provider limit, with a conservative 30 MB browser-side raw-file limit

A successful API response means Resend accepted the message. It does not by itself prove inbox delivery. Delivery status is updated from signed webhook events.

## Inbound flow

1. Resend receives mail for the verified domain.
2. Resend sends a signed `email.received` webhook.
3. The Worker verifies the raw request body and Svix headers.
4. The Worker retrieves the complete message through the Resend Receiving API.
5. The Worker inserts the message idempotently using the Resend email ID.
6. The Worker atomically claims forwarding work.
7. Resend native forwarding sends the original message, including attachments and inline content, to the notification destination.
8. Success or failure is recorded in `inbound_emails`.
9. A forwarding failure returns HTTP 500 so Resend retries the webhook.

Old rows are treated as already forwarded. New rows are inserted with `forward_status = 'pending'`.

## Webhook events

Configure the Resend webhook endpoint to send these events to the same signed endpoint:

- `email.received`
- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.failed`
- `email.bounced`
- `email.suppressed`
- `email.complained`

The application stores outbound status in `sent_emails.delivery_status`, with the latest error and event timestamp.

## DNS requirements

The domain must retain the Resend-provided sending and receiving records:

- inbound MX for the receiving domain
- SPF for the sending subdomain
- DKIM public key

Add DMARC at `_dmarc.tahinspare.com`. Start with monitoring (`p=none`) and review reports before moving to `quarantine` or `reject`.

## Operational verification

Before production deployment:

1. Rotate any API key that was ever committed or shared.
2. Replace both Cloudflare and local development Resend keys.
3. Verify the Resend domain and receiving configuration.
4. Verify the webhook URL and event selections.
5. Confirm `RESEND_WEBHOOK_SECRET` matches the active webhook signing secret.
6. Send a test message from the admin UI to an external mailbox.
7. Confirm the admin status changes from `accepted` or `sent` to `delivered`.
8. Send an external message to `sales@tahinspare.com` with a file attachment.
9. Confirm it appears in the admin inbox and arrives at the notification mailbox with the attachment intact.
10. Review Cloudflare logs for provider, webhook, or database errors.

## Credential incident remediation

If a credential was committed:

1. Revoke or rotate it immediately.
2. Update Cloudflare secrets and local development secrets.
3. Remove it from the current tree.
4. Purge it from Git history using an approved history-rewrite process.
5. Force-push only after coordinating with every collaborator.
6. Re-clone or carefully rebase all existing working copies.
7. Enable repository secret scanning and push protection.

Never assume deleting the line in a later commit invalidates the exposed credential.
