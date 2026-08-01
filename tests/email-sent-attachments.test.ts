import assert from "node:assert/strict";
import test from "node:test";

import type {
  EmailFileAttachmentInput,
  InlineEmailImageInput,
} from "../src/lib/server/email-service.ts";
import {
  buildStoredSentAttachmentManifest,
  parseStoredSentAttachments,
} from "../src/lib/server/sent-email-attachments.ts";

const inlineImages: InlineEmailImageInput[] = [
  {
    id: "email-image-photo-1",
    filename: "pump.jpg",
    contentType: "image/jpeg",
    contentBase64: "aGVsbG8=",
    size: 5,
  },
];

const fileAttachments: EmailFileAttachmentInput[] = [
  {
    id: "email-file-quote-1",
    filename: "quotation.pdf",
    contentType: "application/pdf",
    contentBase64: "cGRm",
    size: 3,
  },
];

test("buildStoredSentAttachmentManifest preserves inline and file metadata", () => {
  const manifest = buildStoredSentAttachmentManifest(
    "sent-email-1",
    inlineImages,
    fileAttachments
  );

  assert.deepEqual(manifest, [
    {
      id: "email-image-photo-1",
      filename: "pump.jpg",
      contentType: "image/jpeg",
      contentDisposition: "inline",
      contentId: "email-image-photo-1",
      storageKey: "email/sent/sent-email-1/email-image-photo-1",
    },
    {
      id: "email-file-quote-1",
      filename: "quotation.pdf",
      contentType: "application/pdf",
      contentDisposition: "attachment",
      contentId: "",
      storageKey: "email/sent/sent-email-1/email-file-quote-1",
    },
  ]);
});

test("parseStoredSentAttachments round-trips valid stored metadata", () => {
  const manifest = buildStoredSentAttachmentManifest(
    "sent-email-1",
    inlineImages,
    fileAttachments
  );

  assert.deepEqual(parseStoredSentAttachments(JSON.stringify(manifest)), manifest);
});

test("parseStoredSentAttachments rejects malformed and unsafe entries", () => {
  assert.deepEqual(parseStoredSentAttachments("not-json"), []);
  assert.deepEqual(
    parseStoredSentAttachments(JSON.stringify([
      {
        id: "bad",
        filename: "secret.txt",
        contentType: "text/plain",
        contentDisposition: "attachment",
        contentId: "",
        storageKey: "uploads/other-object",
      },
    ])),
    []
  );
});

test("buildStoredSentAttachmentManifest sanitizes generated identity into a private prefix", () => {
  const manifest = buildStoredSentAttachmentManifest(
    "sent/email unsafe",
    [
      {
        id: "photo/../../unsafe",
        filename: "image.png",
        contentType: "image/png",
        contentBase64: "aGVsbG8=",
      },
    ],
    []
  );

  assert.match(manifest[0].storageKey, /^email\/sent\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/);
  assert.equal(manifest[0].storageKey.includes(".."), false);
  assert.equal(manifest[0].storageKey.includes("/../../"), false);
});
