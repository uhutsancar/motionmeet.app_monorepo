# ADR 003 — Media: verify synchronously, enrich asynchronously

Status: accepted for the current step, November 2026. A fuller asset model is
described below as the next step, not built.

## Context

Uploads go straight to S3 with a presigned PUT; creating the post resolves the
keys. The plan proposed moving verification to a worker and publishing posts
only when their media is `ready`.

## Decision (implemented)

- **Verification stays on the create path.** Owner, purpose, expiry, size
  bounds (12 B – purpose maximum), S3's stored type and the file's own leading
  bytes are checked before the post exists. It is two small S3 calls per file,
  run in parallel, and it is what guarantees an unverified object is never
  attached to visible content. Moving it to a worker would require private
  staging storage and a `processing` state that every feed, profile and share
  path would have to hide — a large change with no measured latency problem
  behind it.
- **Facts are stored per file**: each `post_media` row has its own verified
  MIME type and byte size. Nothing is guessed.
- **Enrichment is asynchronous.** The post's transaction writes a
  `media.uploaded` event; the `media-metadata` consumer reads at most the first
  256 KB (25 MB for JPEGs with a large EXIF block), takes the dimensions from
  sharp with the pixel cap, corrects for EXIF orientation and fills only rows
  still missing them.
- **Client uploads** read 32 bytes and the on-disk size instead of the whole
  file, stream from disk with real progress, and cancel the native transfer on
  abort, after 30 s without progress, or at a deadline that grows with the file.
- **Retries keep their keys.** A failed create leaves directly uploaded keys
  reserved; the abandoned-upload sweep removes them after an hour.

## Next step (not built)

When video volume or processing cost justifies it: a `media_assets` table
(reserved → uploaded → validating → processing → ready → deleted) beside the
current columns (expand/contract), a private staging prefix, a `processing`
post state hidden from every read path, an ffprobe/FFmpeg worker for duration,
poster frames and faststart MP4. HLS only if playback metrics show the need.

## Measurements that would change this

- `motionmeet_http_request_duration_seconds{route="/api/post/"}` p95 dominated
  by the S3 verification calls.
- Video share of uploads, and video start-up failures on clients.
