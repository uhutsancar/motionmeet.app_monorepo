# Exercise dataset and media policy

The local `exercises-dataset-main` snapshot is not bundled, served, copied into
Docker images, or committed. The former development-only filesystem route has
been removed.

## Current import behavior

`packages/backend/scripts/seedExercises.js` can import normalized metadata into
MongoDB. It does not grant or validate media redistribution rights. Any relative
`gifUrl` copied from the snapshot is intentionally unusable by production
clients, which accept only public HTTP(S) media URLs.

Before a production seed:

1. Pin and review the metadata revision.
2. Remove duplicate/inconsistent records and validate localized instructions.
3. Obtain a MotionMeet-specific license for every image/GIF, or replace it with
   original/redistributable media.
4. Upload licensed media to the configured object store/CDN.
5. Store the resulting absolute HTTPS URL in `Exercise.gifUrl`.
6. Run a sample visual and content review on web and mobile.

## License constraint

The upstream repository's text/metadata license does not automatically grant a
production redistribution license for the exercise media. The snapshot must
remain excluded until rights are documented.

- [Upstream repository](https://github.com/hasaneyldrm/exercises-dataset)
- [Upstream MIT license](https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/LICENSE)
- [Upstream media notice](https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/NOTICE.md)
- [Gym Visual terms](https://gymvisual.com/content/3-terms-and-conditions-of-use)

`.gitignore` and `.dockerignore` enforce the source and image exclusion.
