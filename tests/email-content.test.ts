import assert from "node:assert/strict";
import test from "node:test";

import {
  isSafeInlineImageContentType,
  sanitizeEmailHeader,
  sanitizeEmailHtml,
  type InboundEmailAttachment
} from "../src/lib/server/email-content.ts";

const attachments: InboundEmailAttachment[] = [
  {
    id: "attachment-1",
    filename: "engine-photo.jpg",
    contentType: "image/jpeg",
    contentDisposition: "inline",
    contentId: "photo-1"
  }
];

test("sanitizeEmailHtml rewrites CID images to the authenticated attachment endpoint", () => {
  const html = sanitizeEmailHtml(
    '<p>Photo</p><img src="cid:photo-1" onerror="alert(1)">',
    attachments,
    "inbound-1"
  );

  assert.match(
    html,
    /src="\/api\/admin\/emails\/inbound\/inbound-1\/attachments\/attachment-1"/
  );
  assert.doesNotMatch(html, /onerror|cid:/i);
});

test("sanitizeEmailHtml rewrites sent CID images to the authenticated sent attachment endpoint", () => {
  const html = sanitizeEmailHtml(
    '<p>Sent photo</p><img src="cid:photo-outbound">',
    [{
      id: "sent-photo-1",
      filename: "sent-pump.jpg",
      contentType: "image/jpeg",
      contentDisposition: "inline",
      contentId: "photo-outbound"
    }],
    "sent-1",
    "sent"
  );

  assert.match(
    html,
    /src="\/api\/admin\/emails\/sent\/sent-1\/attachments\/sent-photo-1"/
  );
  assert.doesNotMatch(html, /cid:/i);
});

test("sanitizeEmailHtml removes scripts and unsafe links from inbound email HTML", () => {
  const html = sanitizeEmailHtml(
    '<script>alert(1)</script><a href="javascript:alert(2)">Open</a><img src="data:image/svg+xml,bad"><p style="position:fixed">Safe text</p>',
    [],
    "inbound-1"
  );

  assert.doesNotMatch(html, /script|javascript:|data:image|position:/i);
  assert.match(html, /Safe text/);
});

test("sanitizeEmailHtml does not inline active image formats", () => {
  const html = sanitizeEmailHtml(
    '<img src="cid:vector-1">',
    [{
      id: "attachment-svg",
      filename: "vector.svg",
      contentType: "image/svg+xml",
      contentDisposition: "inline",
      contentId: "vector-1"
    }],
    "inbound-1"
  );

  assert.doesNotMatch(html, /attachment-svg|cid:/i);
});

test("sanitizeEmailHtml resolves encoded, bracketed CID image and image links", () => {
  const html = sanitizeEmailHtml(
    '<a href="cid:%3CPHOTO-1%3E"><img src="CID:%3CPhoto-1%3E" alt="image.png"></a>',
    attachments,
    "inbound-1"
  );

  const safeUrl = "/api/admin/emails/inbound/inbound-1/attachments/attachment-1";
  assert.match(html, new RegExp(`href="${safeUrl}"`));
  assert.match(html, new RegExp(`src="${safeUrl}"`));
  assert.doesNotMatch(html, /cid:/i);
});

test("sanitizeEmailHtml resolves only unique matching relative attachment filenames", () => {
  const matched = sanitizeEmailHtml(
    '<a href="image.png"><img src="./image.png" alt="image.png"></a>',
    [{ ...attachments[0], filename: "image.png", contentId: "" }],
    "inbound-1"
  );
  assert.match(matched, /src="\/api\/admin\/emails\/inbound\/inbound-1\/attachments\/attachment-1"/);
  assert.match(matched, /href="\/api\/admin\/emails\/inbound\/inbound-1\/attachments\/attachment-1"/);

  const ambiguous = sanitizeEmailHtml(
    '<img src="image.png" alt="image.png">',
    [
      { ...attachments[0], filename: "image.png", contentId: "" },
      { ...attachments[0], id: "attachment-2", filename: "image.png", contentId: "" },
    ],
    "inbound-1"
  );
  assert.doesNotMatch(ambiguous, /\/attachments\/attachment-[12]/);
});

test("sanitizeEmailHtml removes unresolvable CID image links instead of navigating to the current page", () => {
  const html = sanitizeEmailHtml(
    '<a href="cid:missing"><img src="cid:missing" alt="image.png"></a>',
    [],
    "inbound-1"
  );
  assert.doesNotMatch(html, /href=""/);
  assert.doesNotMatch(html, /cid:/i);
  assert.doesNotMatch(html, /\/attachments\//);
});

test("safe inline image types are limited to passive raster formats", () => {
  assert.equal(isSafeInlineImageContentType("image/jpeg"), true);
  assert.equal(isSafeInlineImageContentType("image/png; charset=binary"), true);
  assert.equal(isSafeInlineImageContentType("image/svg+xml"), false);
  assert.equal(isSafeInlineImageContentType("text/html"), false);
});

test("sanitizeEmailHeader removes line breaks and collapses whitespace", () => {
  assert.equal(
    sanitizeEmailHeader("New enquiry\r\nBcc: attacker@example.com   from   customer"),
    "New enquiry Bcc: attacker@example.com from customer"
  );
});
