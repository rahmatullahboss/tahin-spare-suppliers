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
