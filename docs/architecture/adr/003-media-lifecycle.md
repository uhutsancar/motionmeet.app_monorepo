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

## Video metadata (implemented, second pass)

The same `media-metadata` consumer measures videos with ffprobe: duration and
display size (rotation-aware), read over a five-minute presigned URL with
https-only protocols, bounded probe size and a 30-second timeout; errors are
logged by exit code only so the signed URL never reaches logs or the outbox.
FFmpeg ships only in the worker's `media-runtime` image target.

## Private media delivery (2026-11 audit, WP-06)

### Problem

Media URLs were built once, at upload, and stored: unsigned ImageKit URLs
without an expiry, whose path is the S3 object key. Whoever had seen one kept
it for good — after the post was deleted, the account went private, or the
viewer was unfollowed; story media stayed reachable after the 24 hours.
Exercise artwork is documented as coming from a public bucket, and user media
appears to use the same `AWS_BUCKET_NAME`: if that bucket grants public read
on every object, the S3 address in the path bypasses ImageKit altogether
(Ek B-1; must be checked on the real bucket).

### Decision

- **URLs are built when a response is built** (`services/mediaDelivery.ts`),
  signed with the ImageKit SDK (`signed: true` and always an `expireSeconds`;
  never the SDK's no-expiry default). The stored URL is only a record and the
  `MEDIA_SIGNED_DELIVERY=false` rollback path.
- **Windows (D-02).** Expiry `= ceil((now + M) / W) * W`: every request in a
  window gets byte-identical URLs (CDN and client caches keep working) and a
  URL always has between `M` and `W + M` left.

  | Purpose | W | M | Longest life of a handed-out link |
  | --- | --- | --- | --- |
  | messages | 1 h | 5 min | 65 min |
  | stories | 1 h | 5 min | 65 min, and never past the story's `expires_at` |
  | posts | 6 h | 15 min | 6 h 15 min |
  | profiles, covers | 24 h | 1 h | 25 h |
  | share-page preview image (public posts of public accounts only) | 7 d | 1 d | 8 d |

  `M` exceeds every response cache TTL (≤ 60 s), so a URL from a cached page
  still has minutes left.
- **Every hydration path signs**: post media (`hydratePosts`), story media,
  message photos, and every avatar/cover through `publicUser`,
  `serializeUser`, `userService.brief`, nearby and follow-request lists.
- **Size variants.** A signed URL cannot be resized by the client (the width
  is part of what is signed), so post images carry `variants: { thumb, feed,
  detail }`, each signed at the display width. `mediaVariantUrl` never touches
  a URL with `ik-s`; `mediaVariantFrom`/`mediaSrcSetFrom` prefer the variants.
- **No unsigned fallback.** A medium of ours whose key cannot be recovered is
  returned as `url: null` + `unavailable: true` (posts), `media_url: null` +
  `mediaUnavailable: true` (messages, stories) or `""` (avatar/cover, which
  every client already renders as the default avatar), and counted in
  `motionmeet_media_url_unresolvable_total{purpose}`. `pnpm --filter
  @motionmeet/backend backfill:media-keys` writes recoverable keys into old
  rows and lists the rest by id. URLs on someone else's host pass through.
- **Deletion (D-03).** Default: no CDN purge (`IMAGEKIT_PURGE_ON_DELETE=false`).
  Consequence, accepted as a product decision: after a deletion or a loss of
  access (unfollow, account going private), someone who already holds a link
  can use it for at most its remaining life (table above); nobody can obtain a
  new one, because access is checked on every request. With the flag on, the
  media deletion job purges `<endpoint>/<key>*` after the S3 delete, retried
  with the job's backoff (Ek B-3: confirm wildcard purge and the plan's quota
  first). Browser and app caches are not reachable by any purge.
- **Bucket.** User media prefixes (`posts/`, `stories/`, `messages/`,
  `profiles/`, `covers/`) must not be anonymously readable; public read only
  for `exercises/*`, or user media in a bucket of its own. Example policy:
  `infra/s3/user-media-bucket-policy.example.json` (Ek B-1).
- **Order.** Clients first (older builds add a width to the URL, which breaks
  a signature), then the backend, then `backfill:media-keys`, then ImageKit
  "Restrict unsigned URLs" (Ek B-2); DEPLOYMENT.md has the details. After that
  last step old unsigned links stop working and `MEDIA_SIGNED_DELIVERY=false`
  would break every image. Exercise artwork is served from S3 directly, not
  through ImageKit, so the restriction does not affect it — re-check if that
  ever changes.

## Next step (not built)

When video volume or processing cost justifies it: a `media_assets` table
(reserved → uploaded → validating → processing → ready → deleted) beside the
current columns (expand/contract), a private staging prefix, a `processing`
post state hidden from every read path, poster frames and faststart MP4. HLS
only if playback metrics show the need.

## Measurements that would change this

- `motionmeet_http_request_duration_seconds{route="/api/post/"}` p95 dominated
  by the S3 verification calls.
- Video share of uploads, and video start-up failures on clients.
