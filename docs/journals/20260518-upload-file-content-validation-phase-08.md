# Upload File Content Validation Phase 08

**Date**: 2026-05-18 14:36
**Severity**: High
**Component**: Public upload portal file validation
**Status**: Resolved

## What Happened

Phase 08 hardened upload validation so the portal now checks magic bytes for PDF, JPEG, PNG, WebP, HEIC, and HEIF before any storage write. Invalid files now fail with `INVALID_FILE_CONTENT` before R2 or RawImage writes, so bad payloads never reach object storage or downstream image processing.

## The Brutal Truth

This needed to be stricter from the start. Letting extension checks carry trust was sloppy, and it would have been embarrassing to discover forged uploads after storage writes had already happened. The memory review was the other sharp edge: reading whole files too early would have turned validation into a silent RAM tax on every upload.

## Technical Details

Implemented magic-byte validation for:
- PDF
- JPEG
- PNG
- WebP
- HEIC
- HEIF

Failure path now returns `INVALID_FILE_CONTENT` before any R2 or RawImage write. The memory fix was to read signature slices first, then stream full file buffers sequentially only after validation passes. That keeps the hot path cheap and avoids holding unnecessary file data in memory during signature checks.

Validation passed:
- `pnpm -F @ella/api test -- file-signature-validation portal`
- `pnpm -F @ella/api type-check`
- `pnpm -F @ella/portal type-check`

## What We Tried

- Initially leaned on filename and mime hints, then replaced that with magic-byte inspection.
- Reviewed the read path and moved signature extraction ahead of full-buffer reads.
- Kept the validation gate before any storage client call to avoid partial side effects.

## Root Cause Analysis

The root mistake was trusting user-controlled metadata. The second mistake was not treating file validation as a memory-sensitive path. Both are basic failures, and both would have become real incidents under load.

## Lessons Learned

Upload validation has to verify bytes, not labels. Also, any file-heavy path needs a memory review before merge, not after someone notices the process is chewing through RAM.

## Next Steps

Phase 08 is complete. Next work should keep content validation, storage writes, and image ingestion reviewed together so the reject path stays cheaper than the accept path.

## Unresolved Questions

None
