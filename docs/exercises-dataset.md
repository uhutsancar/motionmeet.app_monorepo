# Exercise dataset and media policy

Licence terms for both bundled datasets live in [LICENSES.md](LICENSES.md).
This file covers the import mechanics.

The local `exercises-dataset-main` snapshot is not bundled, served, copied into
Docker images, or committed — `.gitignore` and `.dockerignore` enforce that. The
former development-only filesystem route has been removed.

## Current import behaviour

`packages/backend/scripts/seedExercises.ts` imports normalized metadata into
PostgreSQL. It does not grant or validate media redistribution rights. Any
relative `gifUrl` copied from the snapshot is intentionally unusable by
production clients, which accept only public HTTP(S) media URLs.

`packages/backend/scripts/uploadExercisesToS3.ts` copies the media into the
configured bucket and rewrites the rows to absolute URLs. **It has already been
run against this database**: 1,323 of 1,325 rows serve their image and GIF from
`s3.eu-north-1.amazonaws.com/motionmeet-assets/exercises/…`. See the open
licence question in [LICENSES.md §2b](LICENSES.md#2b-exercise-images-and-gifs--
gym-visual-not-mit) before a public release.

Before a production seed:

1. Pin and review the metadata revision.
2. Remove duplicate/inconsistent records and validate localized instructions.
3. Obtain a MotionMeet-specific licence for every image/GIF, or replace it with
   original/redistributable media.
4. Upload licensed media to the configured object store/CDN.
5. Store the resulting absolute HTTPS URL in `Exercise.gifUrl`.
6. Run a sample visual and content review on web and mobile.

## Attribution in the app

The **© Gym visual — https://gymvisual.com/** notice renders under the animation
on the mobile exercise detail screen and in Settings → Data & licences. Both are
licence obligations and must not be removed from a release build.

## Sources

- [Upstream repository](https://github.com/hasaneyldrm/exercises-dataset)
- [Upstream MIT license](https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/LICENSE)
- [Upstream media notice](https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/NOTICE.md)
- [Gym Visual terms](https://gymvisual.com/content/3-terms-and-conditions-of-use)
