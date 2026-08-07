# Third-party data licences

Two datasets ship inside MotionMeet. This file records what each one permits,
what MotionMeet is obliged to do in return, and what is still open. Verified
against upstream on 2026-08-07.

Where the notices appear in the product:

| Surface | Location dataset | Exercise media |
| --- | --- | --- |
| Mobile — Settings → Data & licences | ✅ | ✅ |
| Mobile — location picker footer | ✅ | — |
| Mobile — location settings footer | ✅ | — |
| Mobile — exercise detail, under the animation | — | ✅ |
| Web — profile editor, under the location field | ✅ | — |
| API — `GET /api/locations/attribution` | ✅ | — |

None of these may be removed from a production build.

---

## 1. Countries States Cities Database — location data

- Upstream: <https://github.com/dr5hn/countries-states-cities-database>
- Pinned release: `v3.2-export.7`
- Licence: **Open Database License (ODbL) v1.0** — <https://opendatacommons.org/licenses/odbl/1-0/>

### What it permits

Commercial use, modification and redistribution.

### What MotionMeet owes

1. **Attribution.** The upstream-specified notice is shipped verbatim as
   `LOCATION_DATASET_ATTRIBUTION` in `packages/shared/src/types/location.ts`:

   ```
   Data by Countries States Cities Database
   https://github.com/dr5hn/countries-states-cities-database | ODbL v1.0
   ```

2. **Share-alike on a Derivative Database.** ODbL §4.4 applies when a *database*
   derived from this one is publicly used. MotionMeet stores an extracted subset
   (names, parents, coordinates, population, plus a generated `search_name` key)
   and serves individual records through the search API.

   Serving individual results is a "Produced Work" and carries only the
   attribution duty. The extracted subset itself is a Derivative Database, so if
   MotionMeet ever *publishes that database* — a bulk export endpoint, a
   downloadable dump, an embedded copy inside a client — it must be offered
   under ODbL as well. Today nothing does: the search endpoint is
   authenticated, rate-limited, capped at 25 rows per request, and there is no
   bulk export. **Adding one would trigger the share-alike duty; check before
   building it.**

3. **No technological restriction.** ODbL §4.7 forbids using DRM to stop others
   exercising their rights over the data. Rate limits protecting an
   authenticated API are not DRM; a paywall around the data as data would be.

### What MotionMeet keeps

Only the columns the product reads. The upstream export also carries currency
codes, TLDs, GDP, postal-code regexes, timezone tables, wikidata ids and machine
translations into nineteen languages; none of that is imported. See
`packages/backend/scripts/importLocationDataset.ts`.

Country names additionally keep their Turkish translation, which is
human-curated upstream. State and city translations are not, and are skipped —
the machine-translated German for "Bursa" is the word for a bursa sac.

### Status

✅ **Clear for production.** Obligations are met by the attribution surfaces
listed above.

---

## 2. hasaneyldrm/exercises-dataset — exercise data and media

- Upstream: <https://github.com/hasaneyldrm/exercises-dataset>
- Local snapshot: `exercises-dataset-main/` (git-ignored, not bundled, not in
  Docker images)

The repository is **two things under two licences**, and the distinction is the
whole point.

### 2a. Exercise data — MIT

Names, categories, body parts, equipment, targets, muscle groups and the
multilingual instructions are released under the MIT License.

✅ **Clear for production**, including commercially.

### 2b. Exercise images and GIFs — © Gym visual, not MIT

Upstream `NOTICE.md` states:

> The exercise **media** (thumbnail images and animation GIFs) in this
> repository is the property of **Gym visual** and is redistributed here **with
> permission**.
>
> - **Resolution:** distributed at **180×180** only.
> - **Attribution:** every use must carry the copyright indication
>   **© Gym visual — https://gymvisual.com/**.
>
> The media is included here with the rights holder's **separate written
> permission** … **This repository does not grant you any rights to the media
> beyond what Gym visual's terms allow** — cloning this repo is not a licence.

Gym visual's terms: <https://gymvisual.com/content/3-terms-and-conditions-of-use>

> Note: the local `exercises-dataset-main/` snapshot was taken on 2026-07-18,
> before upstream published `NOTICE.md`. Its README carries the older wording
> ("educational and non-commercial research purposes only… Commercial use is
> strictly prohibited", media sourced from a Kaggle dataset). Both wordings
> agree on the operative point: **the media is not MotionMeet's to redistribute
> without its own permission.**

### Current state in this repository

`packages/backend/scripts/uploadExercisesToS3.ts` has been run. As of
2026-08-07, 1,323 of 1,325 rows in `exercises` serve `image_url` and `gif_url`
from MotionMeet's own bucket:

```
https://s3.eu-north-1.amazonaws.com/motionmeet-assets/exercises/videos/…
```

That is MotionMeet redistributing Gym visual's media from its own
infrastructure, to its own users.

### What has been done

- The required notice **© Gym visual — https://gymvisual.com/** now renders
  directly under the animation on the exercise detail screen, and again in
  Settings → Data & licences.

### What is still open — decision required before public release

1. **MotionMeet needs its own licence from Gym visual.** The permission in the
   upstream repository was granted to that repository, and it says so
   explicitly. Re-hosting the files on `motionmeet-assets` is a separate
   redistribution that permission does not cover.
2. **The 180×180 limit must be verified** against what is actually in the
   bucket; the upstream permission is scoped to that resolution.

Until (1) is resolved, the options are: obtain a licence from Gym visual,
replace the media with originally produced or clearly redistributable
animations, or ship exercises without media. The metadata (2a) is unaffected in
every case — only the images and GIFs are in question.

⚠️ **Not cleared for production.** This is a commercial/legal decision, not a
technical one.

---

## Refreshing a dataset

Location data is re-imported by bumping `DATASET_VERSION` in
`packages/backend/scripts/importLocationDataset.ts` and re-running
`pnpm --filter @motionmeet/backend run import:locations`. Rows that disappear
upstream are flagged `is_active = false` rather than deleted, so members whose
profile points at one keep their location. Re-read this file when the pinned
version changes: the licence can change with it.
