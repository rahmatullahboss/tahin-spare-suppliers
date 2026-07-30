import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInboundForwardRequest,
  prepareEmailAttachments,
  prepareFileAttachments,
  prepareInlineImageAttachments,
  type EmailFileAttachmentInput,
  type InlineEmailImageInput
} from "../src/lib/server/email-service.ts";

test("prepareInlineImageAttachments keeps referenced cid images as inline attachments", () => {
  const images: InlineEmailImageInput[] = [
    {
      id: "email-image-1",
      filename: "pump.jpg",
      contentType: "image/jpeg",
      contentBase64: "aGVsbG8="
    },
    {
      id: "unused-image",
      filename: "unused.png",
      contentType: "image/png",
      contentBase64: "dW51c2Vk"
    }
  ];

  const attachments = prepareInlineImageAttachments(
    '<p>Photo:</p><img src="cid:email-image-1" alt="pump" />',
    images
  );

  assert.deepEqual(attachments, [
    {
      filename: "pump.jpg",
      content: "aGVsbG8=",
      contentType: "image/jpeg",
      contentId: "email-image-1"
    }
  ]);
});

test("prepareInlineImageAttachments rejects unsupported image MIME types", () => {
  const images: InlineEmailImageInput[] = [
    {
      id: "email-image-1",
      filename: "not-image.svg",
      contentType: "image/svg+xml",
      contentBase64: "PHN2Zy8+"
    }
  ];

  assert.throws(
    () => prepareInlineImageAttachments('<img src="cid:email-image-1" />', images),
    /Unsupported inline image type/
  );
});

test("prepareEmailAttachments includes normal file attachments without content ids", () => {
  const inlineImages: InlineEmailImageInput[] = [
    {
      id: "email-image-1",
      filename: "pump.jpg",
      contentType: "image/jpeg",
      contentBase64: "aW1hZ2U="
    }
  ];
  const fileAttachments: EmailFileAttachmentInput[] = [
    {
      filename: "quotation.pdf",
      contentType: "application/pdf",
      contentBase64: "cGRm",
      size: 3
    },
    {
      filename: "price list.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      contentBase64: "eGxzeA==",
      size: 4
    }
  ];

  const attachments = prepareEmailAttachments(
    '<p>Photo:</p><img src="cid:email-image-1" alt="pump" />',
    inlineImages,
    fileAttachments
  );

  assert.deepEqual(attachments, [
    {
      filename: "pump.jpg",
      content: "aW1hZ2U=",
      contentType: "image/jpeg",
      contentId: "email-image-1"
    },
    {
      filename: "quotation.pdf",
      content: "cGRm",
      contentType: "application/pdf"
    },
    {
      filename: "price list.xlsx",
      content: "eGxzeA==",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
  ]);
});

test("prepareEmailAttachments rejects too many normal file attachments", () => {
  const fileAttachments: EmailFileAttachmentInput[] = Array.from({ length: 11 }, (_, index) => ({
    filename: `file-${index}.pdf`,
    contentType: "application/pdf",
    contentBase64: "cGRm",
    size: 3
  }));

  assert.throws(
    () => prepareEmailAttachments("<p>Hello</p>", [], fileAttachments),
    /Maximum 10 files can be attached/
  );
});

test("prepareFileAttachments validates base64 content instead of trusting client size", () => {
  assert.throws(
    () => prepareFileAttachments([
      {
        filename: "fake.pdf",
        contentType: "application/pdf",
        contentBase64: "not-valid-base64!",
        size: 1
      }
    ]),
    /Invalid attachment content/
  );
});

test("prepareEmailAttachments ignores inline images that are no longer referenced", () => {
  const attachments = prepareEmailAttachments(
    "<p>The removed image should not be sent.</p>",
    [
      {
        id: "removed-image",
        filename: "removed.jpg",
        contentType: "image/jpeg",
        contentBase64: "not-valid-base64!"
      }
    ],
    []
  );

  assert.deepEqual(attachments, []);
});

test("buildInboundForwardRequest forwards the original received email", () => {
  assert.deepEqual(
    buildInboundForwardRequest("received-email-id"),
    {
      emailId: "received-email-id",
      to: "tahinship@gmail.com",
      from: "Tahin Spare Suppliers <sales@tahinspare.com>"
    }
  );
});
