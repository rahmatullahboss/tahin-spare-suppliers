import assert from "node:assert/strict";
import test from "node:test";

import {
  isSafeInlineImageContentType,
  parseInboundAttachments,
  recoverEmbeddedInlineImage,
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

test("received images embedded as base64 map to their unique manifest sizes even when filenames repeat", () => {
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  const first = Uint8Array.from([...pngSignature, 1, 2, 3]);
  const second = Uint8Array.from([...pngSignature, 4, 5, 6, 7, 8]);
  const third = Uint8Array.from([...pngSignature, 9, 10, 11, 12, 13, 14, 15]);
  const attachments = parseInboundAttachments(JSON.stringify([first, second, third].map((bytes, index) => ({
    id: `image-${index + 1}`,
    filename: "image.png",
    content_type: "image/png",
    content_id: `<image-${index + 1}>`,
    content_disposition: "inline",
    size: bytes.length
  }))));
  const body = [first, second, third].map((bytes) =>
    `<img src="data:image/png;base64,${Buffer.from(bytes).toString("base64")}" alt="image.png">`
  ).join("");
  const html = sanitizeEmailHtml(body, attachments, "email-1");

  for (let i = 1; i <= 3; i += 1) {
    assert.match(html, new RegExp(`src="/api/admin/emails/inbound/email-1/attachments/image-${i}"`));
    const recovered = recoverEmbeddedInlineImage(body, attachments, `image-${i}`);
    assert.ok(recovered);
    assert.deepEqual(recovered.bytes, [first, second, third][i - 1]);
    assert.equal(recovered.contentType, "image/png");
  }
  assert.doesNotMatch(html, /data:image|base64/);
});

test("embedded images fail closed when the size is ambiguous or metadata absent", () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 4, 5, 6, 7]);
  const body = `<img src="data:image/png;base64,${bytes.toString("base64")}">`;
  const duplicate = parseInboundAttachments(JSON.stringify([1, 2].map((index) => ({
    id: `duplicate-${index}`,
    filename: "image.png",
    content_type: "image/png",
    content_disposition: "inline",
    size: bytes.length
  }))));
  assert.doesNotMatch(sanitizeEmailHtml(body, duplicate, "email-1"), /\/attachments\//);
  assert.equal(recoverEmbeddedInlineImage(body, duplicate, "duplicate-1"), null);
  assert.doesNotMatch(sanitizeEmailHtml(body, [], "email-1"), /data:image/);
});

test("embedded image recovery checks actual raster signature", () => {
  const bytes = Buffer.from("malicious markup");
  const body = `<img src="data:image/png;base64,${bytes.toString("base64")}">`;
  const manifest = parseInboundAttachments(JSON.stringify([{
    id: "spoofed",
    filename: "image.png",
    content_type: "image/png",
    size: bytes.length
  }]));
  assert.equal(recoverEmbeddedInlineImage(body, manifest, "spoofed"), null);
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
