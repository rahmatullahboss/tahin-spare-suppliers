# Admin Image Lifecycle Design

Date: 2026-04-07
Project: tahin-spare-suppliers
Scope: Admin content image upload UX and R2 asset lifecycle for products/equipment and blog posts

## Goal

Replace the current two-step admin image flow with a single save-driven flow:

- The editor selects an image once.
- The browser shows a local preview immediately.
- Compression and R2 upload happen only when the user clicks `Save`.
- If the user cancels before saving, no orphan file remains in R2.
- If the user removes, replaces, or deletes a saved post/product image, the corresponding R2 object is deleted.

Images are post-specific assets. Reuse across multiple posts is not supported.

## Current Problems

- The admin UI exposes both `Compress & Upload` and `Save`, which creates a confusing two-step workflow.
- Upload occurs before content save, so an abandoned edit can leave orphan files in R2.
- The current schema stores `image_url` but not the R2 object key, making reliable deletion harder.
- Delete behavior is incomplete: removing an image, replacing an image, or deleting a post does not guarantee storage cleanup.

## Approaches Considered

### Option A: Save-time upload only

Behavior:

- Selecting a file stores it only in browser memory and shows a local preview.
- Clicking `Save` compresses the selected file, uploads it to R2, then saves the content record.
- Reseting or cancelling before save only clears local state.

Pros:

- Simplest UX.
- Minimizes orphan uploads.
- Easiest lifecycle to reason about.

Cons:

- Save action takes slightly longer when a new image is present.

Recommendation: Use this option.

### Option B: Immediate temp upload with later cleanup

Behavior:

- Selecting a file uploads it immediately to R2 as a temporary object.
- Save finalizes the content link.
- Cancel deletes the temp object.

Pros:

- Shorter save action after upload.

Cons:

- More moving parts.
- More failure paths and cleanup races.
- Higher orphan risk if cleanup is missed.

### Option C: Draft-to-final move flow

Behavior:

- Selected files go to a draft namespace.
- Save moves or copies them to final storage.
- Cancel deletes draft files.

Pros:

- Strong separation between temporary and committed assets.

Cons:

- Over-engineered for this project.
- Adds migration and storage complexity with little user benefit.

## Recommended Design

### UX

The image input becomes a single-field flow:

- Remove the separate `Compress & Upload` button.
- Keep one file picker.
- Show local preview immediately after selection.
- Show one clear image state:
  - existing saved image
  - newly selected unsaved image
  - removed image
- Clicking `Save` performs every required action for the image.

### Data Model

Add a persistent object key field for every content type that supports images:

- `image_url`
- `image_key`

`image_key` stores the exact R2 object key used for deletion.

This change applies to:

- products/equipment content
- blog posts
- parts only if that entity remains during the broader taxonomy refactor

## Editor State Model

Each editor session tracks:

- `existingImageUrl`
- `existingImageKey`
- `selectedFile`
- `selectedPreviewUrl`
- `imageRemoved`

Rules:

- If no new file is selected and no removal is requested, keep the current image.
- If a new file is selected, it replaces the current image on save.
- If the user explicitly removes the image, save clears both `image_url` and `image_key`.
- If the user resets the form before saving, all unsaved image state is discarded and the original saved image is restored.

## Save Lifecycle

### Create

1. User selects a file.
2. Browser shows local preview using an object URL.
3. User clicks `Save`.
4. Browser compresses the file to WebP.
5. Client uploads the file to `/api/upload`.
6. API returns:
   - `url`
   - `key`
7. Client saves the content record including `image_url` and `image_key`.
8. If content save fails after upload succeeds, client immediately requests cleanup of the just-uploaded object.

### Update with no image change

1. User edits text only.
2. Save updates the record without touching R2.

### Update with image replacement

1. User selects a new image.
2. Save uploads the new file first.
3. Save updates the content record with new `image_url` and `image_key`.
4. After the DB update succeeds, delete the old R2 object.
5. If the DB update fails, delete the newly uploaded object and keep the old one.

### Update with image removal

1. User removes the current image in the form.
2. Save updates the record to empty `image_url` and `image_key`.
3. After the DB update succeeds, delete the old R2 object.

### Delete content item

1. When a post/product is deleted, read its `image_key`.
2. Delete the database record.
3. Delete the linked R2 object.

Deletion should be best-effort but explicit. A missing object should not fail the content deletion path.

## API Changes

### Upload API

Keep `/api/upload`, but return both:

- `url`
- `key`

It remains authenticated and continues accepting browser-compressed images.

### Delete image API

Add an authenticated delete endpoint for explicit cleanup of uploaded-but-unsaved files if needed after a failed save.

Example responsibility:

- Delete by exact R2 object key only.
- Reject arbitrary URL-based deletion.

Even though the recommended flow avoids normal pre-save uploads, this endpoint is still useful for failure recovery and explicit cleanup.

### Content APIs

Create and update handlers must accept and persist:

- `imageUrl`
- `imageKey`

Delete handlers must load the record first so they can remove the image object after deleting the content.

## Failure Handling

### Upload fails

- Do not save the content record.
- Keep the user on the form.
- Show a clear save error.

### Upload succeeds but record save fails

- Immediately delete the newly uploaded object using its returned key.
- Keep the original saved image untouched for edit flows.

### Old image delete fails after successful record update

- Content save still succeeds.
- Log the failure and return a non-blocking warning in server logs.
- Do not roll back the content record just because storage cleanup failed.

### Client resets or navigates away before save

- No R2 action is needed because uploads do not happen before save.

## UI Changes

Update the image uploader component to support:

- file input only
- existing image preview
- local selected-image preview
- explicit remove image control
- inline status messaging during save

Remove:

- separate upload button
- separate upload success step

The main submit button remains the only commit action.

## Testing Requirements

Verify the following flows:

1. Create a new item with image and save successfully.
2. Create a new item, select image, then reset without saving.
3. Edit an item without changing image.
4. Edit an item and replace image.
5. Edit an item and remove image.
6. Delete an item that has an image.
7. Fail upload and confirm no content record is written.
8. Simulate record-save failure after upload and confirm uploaded file cleanup.

## Out of Scope

- Shared image library
- Media manager UI
- Cross-post image reuse
- Bulk asset cleanup tooling

## Implementation Notes

- Prefer storing and deleting by `image_key`, not by parsing public URLs.
- Revoke browser object URLs when previews are replaced or cleared.
- Keep delete logic idempotent where possible.
- Follow the project rule to avoid introducing `any` while refactoring the editor and API payloads.

## Summary

This design gives the admin one clean action: select image, then click `Save`.

It also makes storage lifecycle deterministic:

- no normal orphan uploads before save
- old files removed on replace
- files removed on image delete
- files removed on content delete
