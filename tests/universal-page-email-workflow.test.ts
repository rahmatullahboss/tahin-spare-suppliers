import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all non-home public pages receive the authenticated universal page editor", async () => {
  const [layout, editor, schema, api] = await Promise.all([
    source("src/layouts/MainLayout.astro"),
    source("src/components/admin/UniversalPageEditor.astro"),
    source("src/lib/server/schema.sql"),
    source("src/pages/api/page-overrides.ts"),
  ]);

  assert.match(layout, /UniversalPageEditor/);
  assert.match(layout, /!isHomepage && <UniversalPageEditor/);
  assert.match(layout, /isAuthenticated\(Astro\.cookies/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS page_overrides/);
  assert.match(editor, /Edit this page/);
  assert.match(editor, /canvas\.toBlob\(resolve, 'image\/webp', 0\.82\)/);
  assert.match(editor, /fetch\('\/api\/upload'/);
  assert.match(api, /requireAdminRequest/);
  assert.match(api, /savePageOverrides/);
});

test("product enquiries open into a detail dialog and can start an email reply", async () => {
  const enquiries = await source("src/pages/admin/enquiries.astro");

  assert.match(enquiries, /id="enquiry-modal"/);
  assert.match(enquiries, /data-enquiry-index/);
  assert.match(enquiries, /function openEnquiry/);
  assert.match(enquiries, /\/admin\/emails\/send\?replyTo=/);
  assert.match(enquiries, /Reply by email/);
});

test("email composer exposes reliable photo and attachment pickers on mobile and desktop", async () => {
  const compose = await source("src/pages/admin/emails/send.astro");

  assert.match(compose, /data-open-photo-picker/);
  assert.match(compose, /data-open-file-picker/);
  assert.match(compose, /Add photo/);
  assert.match(compose, /Attach file/);
  assert.match(compose, /fileAttachments/);
  assert.match(compose, /inlineImages/);
  assert.match(compose, /grid-template-columns: 1fr 1fr/);
});

test("outgoing admin email and replies receive the configured mandatory signature", async () => {
  const [signature, sendApi, signatureAdmin] = await Promise.all([
    source("src/lib/server/email-signature.ts"),
    source("src/pages/api/admin/emails/index.ts"),
    source("src/pages/admin/emails/signature.astro"),
  ]);

  assert.match(signature, /Thanks and Best Regards,/);
  assert.match(signature, /renderEmailSignatureHtml/);
  assert.match(signature, /appendEmailSignature/);
  assert.match(signature, /data-tahin-email-signature/);
  assert.match(signature, /BUSINESS_PROFILE\.website.*settings\.logoUrl/s);
  assert.match(sendApi, /const signedEmailBody = appendEmailSignature/);
  assert.match(sendApi, /html: signedEmailBody/);
  assert.match(signatureAdmin, /<ImageUploader label="Signature Logo"/);
  assert.match(signatureAdmin, /canvas\.toBlob\(resolve, 'image\/webp', \.86\)/);
  assert.match(signatureAdmin, /Uploading logo to R2/);
});

test("inbound email attachment retrieval falls back to Resend attachment listing", async () => {
  const service = await source("src/lib/server/email-service.ts");
  const thread = await source("src/pages/admin/emails/thread/[source]/[id].astro");

  assert.match(service, /receiving\.attachments\.get/);
  assert.match(service, /receiving\.attachments\.list/);
  assert.match(thread, /attachment-preview/);
  assert.match(thread, /Reply/);
  assert.match(thread, /isSafeInlineImageContentType/);
});

test("homepage edit bar and mailbox expose the new management shortcuts", async () => {
  const [homepageEditor, mailbox] = await Promise.all([
    source("src/components/admin/InlinePageEditor.astro"),
    source("src/pages/admin/emails.astro"),
  ]);
  assert.match(homepageEditor, /href="\/admin\/brands">Brands/);
  assert.match(mailbox, /href="\/admin\/emails\/signature" class="signature-btn">Signature/);
});
