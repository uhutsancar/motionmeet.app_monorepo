# Exercise dataset decision

The local `exercises-dataset-main` snapshot is not bundled, served, copied into Docker images, or committed.

## Audit result

- Snapshot size: about 150 MB across 2,653 files.
- Records: 1,324 exercise metadata entries, with 1,324 JPG and 1,324 GIF files.
- Web, mobile, and backend currently have no imports or routes that consume this snapshot.
- The snapshot contains duplicate or inconsistent records, invisible Unicode characters, and instructions that do not always match the named exercise.
- Its record identifiers are not MongoDB ObjectIds and need an explicit import mapping if adopted.

## License constraint

The upstream repository licenses its text/metadata under MIT, but its notice explicitly excludes the exercise media. The Gym Visual terms require an organization-specific media license. The local snapshot does not include a license or notice that grants MotionMeet production redistribution rights.

Relevant sources:

- [Upstream repository](https://github.com/hasaneyldrm/exercises-dataset)
- [Upstream MIT license](https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/LICENSE)
- [Upstream media notice](https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/NOTICE.md)
- [Gym Visual terms](https://gymvisual.com/content/3-terms-and-conditions-of-use)

## Safe paths forward

1. Purchase a MotionMeet-specific Gym Visual license, then normalize metadata and serve media from object storage/CDN with lazy loading.
2. Import only a pinned, license-verified metadata revision and use separately licensed media.
3. Replace the snapshot with an original or fully redistributable dataset.

Until one option is selected, `.gitignore` and `.dockerignore` keep the snapshot out of source control, application bundles, and deployment contexts.

