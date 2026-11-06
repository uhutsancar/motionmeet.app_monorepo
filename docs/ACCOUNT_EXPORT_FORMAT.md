# Account export format (version 4)

`GET /api/user/export` returns everything MotionMeet stores about the signed-in
member as one JSON document. It is the member's copy of their own data (KVKK /
GDPR right of access). The endpoint takes no parameters; it always exports the
authenticated account.

Implementation: `packages/backend/services/accountService.ts`
(`streamAccountData`). Tests: `packages/backend/tests/integration/accountExport.test.ts`.

## Shape

```json
{
  "exportedAt": "2026-11-06T12:00:00.000Z",
  "formatVersion": 4,
  "user": { "id": "…", "email": "…", "username": "…", … },
  "workouts": [ … ],
  "routines": [ … ],
  …
  "complete": true
}
```

- Properties appear in the order of the table below; `user` first, `complete`
  last.
- Every section is an array, empty when there is nothing to export.
- Timestamps are ISO 8601 strings; database `numeric` values may appear as
  strings.

### The completeness marker

The document is streamed, so its HTTP status (200) is sent before the last
section is read. If anything fails after that point, the server **breaks the
connection** instead of ending the body; the client sees a failed download.
`"complete": true` is written only after every section. A file without it was
cut short and should be discarded.

A failure before the first byte (for example the database being unreachable)
is an ordinary error response (`5xx` with a JSON body).

### Consistency

Each section is read in pages of 500 rows in key order, with the database
connection returned to the pool between pages. The document is therefore not
one snapshot: a row written while the export runs may or may not be included,
and two sections can reflect slightly different moments.

## Sections

| Property | Source | Notes |
| --- | --- | --- |
| `user` | `users` | Profile, privacy switches, profile location (label and dataset ids, visibility, source), weight, height, training totals. No password hash, no storage keys |
| `workouts` | `workouts` → `workout_exercises` → `workout_sets` | Each workout has `exercises[]`, each exercise `sets[]` |
| `routines` | `routines` → `routine_exercises` → `routine_sets` | Same nesting as workouts |
| `posts` | `posts` + `post_media` | Each post has `media[]` (URL, type, MIME type, size, dimensions, duration) |
| `stories` | `stories` | Stories that have not expired yet (expired ones are deleted) |
| `storyViewsGiven` | `story_views` | Stories the member viewed |
| `storyLikesGiven` | `story_likes` | Stories the member liked |
| `messages` | `messages` | Sent and received, both directions |
| `conversations` | `conversations` + `conversation_participants` | The member's conversations and their unread count |
| `connections` | `connections` | Legacy two-way connections, both directions |
| `followers` | `user_follows` | Other member's id and username, follow date |
| `following` | `user_follows` | Other member's id and username, follow date |
| `followRequestsSent` | `follow_requests` | Pending requests to private accounts |
| `followRequestsReceived` | `follow_requests` | Pending requests the member has not answered |
| `notifications` | `notifications` | Notifications addressed to the member |
| `likes` | `post_likes` | Posts the member liked |
| `comments` | `post_comments` | The member's comments |
| `customExercises` | `exercises` + `exercise_secondary_muscles` + `exercise_instructions` | Exercises the member created |
| `bodyMeasurements` | `body_measurements` | Every measurement entry |
| `nearby` | `user_locations` | Zero or one row: Nearby settings and the last position, **including latitude, longitude and accuracy** — the member's own data (D-05) |
| `personalRecords` | `personal_records` | |
| `dailyWorkoutStats` | `user_daily_workout_stats` | |
| `dailyMuscleStats` | `user_daily_muscle_stats` | With the day's `date_key` |
| `exerciseDailyStats` | `user_exercise_daily_stats` | |
| `sessions` | `sessions` | Devices, last use, expiry, revocation. No token hash |
| `usage` | `usage_counters` | Quota counters |
| `uploadReservations` | `upload_reservations` | Purpose, type, size limit, expiry. No storage key |

## Never included

- `users.password_hash`, `sessions.token_hash`, `password_reset_tokens`
- Storage object keys (`post_media.object_key`, `stories.media_key`,
  `messages.media_key`, `users.profile_picture_key` / `cover_photo_key`,
  `upload_reservations.object_key`)
- Infrastructure tables: `outbox_events`, `processed_events`,
  `media_deletion_jobs`
- Other members' email addresses or anything beyond their id and username

## Clients

- Web (`Settings.tsx`) downloads the body as a Blob and saves it as
  `motionmeet-export-<date>.json`.
- Mobile (`PrivacyScreen.tsx`) downloads straight to a file in the cache
  directory (`expo-file-system`) and opens the share sheet with that file
  (`expo-sharing`). It no longer reads the export into memory or shares it as
  a text message.

## History

| Version | Change |
| --- | --- |
| 4 | Keyset pages instead of a database cursor (the cursor never worked: every export failed after ~700 bytes); nested workout/routine exercises and sets, post media, custom exercise details; new sections `storyViewsGiven`, `storyLikesGiven`, `followers`, `following`, `followRequestsSent`, `followRequestsReceived`, `notifications`, `bodyMeasurements`, `nearby`, `dailyMuscleStats`; `complete` marker; storage keys removed |
| 3 | Flat table dumps |
