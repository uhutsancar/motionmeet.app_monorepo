# AdMob (test ads only)

Status: banner ad in the Home feed and a native ad tile in the Explore grid,
both gated behind Google's official test ad unit ids. No production ad unit
exists yet, so real ad serving is hardcoded off regardless of build type or
environment - see `src/config/ads.ts`. Verified on-device (Reeder P13 Blue
Max) in both the release APK and via Expo Go (where the ad surfaces correctly
render nothing - see below).

## How it's wired

- `app.config.js` extends the static `app.json` to register the
  `react-native-google-mobile-ads` config plugin with an Android App ID read
  from `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` (falls back to Google's public
  sample App ID if unset). This runs at `expo prebuild` time and bakes the
  App ID into `AndroidManifest.xml` - it is **not** a runtime JS value.
- `src/services/adsModule.ts` gates every use of the SDK behind
  `Constants.appOwnership === 'expo'`. The library has no Expo Go fallback -
  requiring its native module there throws - so under Expo Go every ad
  surface silently renders nothing instead of crashing. This is the one
  Constants field that reliably means "Expo Go" (unlike
  `executionEnvironment`, which is identical for Expo Go and our own
  dev-client).
- `src/services/adsInit.ts` requests UMP consent (`AdsConsent.gatherConsent()`)
  and then calls `mobileAds().initialize()`, once, from `App.tsx`. Every step
  is wrapped so a consent or init failure degrades to "no ads" instead of
  throwing.
- `src/hooks/useAdEntitlement.ts` fails closed: ads are off until the user's
  profile has loaded *and* `plan` has resolved to a populated object. The
  backend already returns it populated (`getUserById(id, { plan: true })`),
  so this normally resolves within one request; if that ever regresses to an
  id-only reference, ads simply never turn on for anyone rather than showing
  to an ad-free/premium user.
- `src/config/ads.ts` is the one place that decides test vs. production ad
  unit ids (`ADS_PRODUCTION_ENABLED`, currently hardcoded `false`) and the ad
  frequency (`nextAdFrequency()`, a random 10-15 gap re-rolled after every
  inserted ad row - a fixed gap read as denser than it is once someone
  scrolled fast enough to see the same rhythm twice).
- `src/pages/Feed.tsx` inserts an `{ type: 'ad' }` banner row client-side into
  the already-paginated list, after every `nextAdFrequency()` real posts,
  never directly before the Suggested/Nearby rows. It does not touch
  `postsSlice`/the pagination cursor - the backend never sees or counts ad
  rows.
- `src/pages/Explore.tsx` does the same thing for its 3-column grid, except
  the inserted item is a native ad tile (`src/components/ads/NativeAdTile.tsx`,
  a compact `NativeAdView` sized to match the surrounding photo tiles) instead
  of a banner. Ad tiles never affect the grid's `numColumns` alignment or the
  post-viewer modal's index mapping into the underlying post array.

## Environment variables

Set in `packages/mobile/.env.local` (gitignored, read by `expo prebuild`/
`expo start`), documented with placeholders in `packages/mobile/.env.example`:

| Variable | Purpose | Currently set to |
|---|---|---|
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | Android App ID baked into AndroidManifest.xml | the real MotionMeet Android App ID from the AdMob console (`ca-app-pub-5742745881289950~...`) |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | iOS App ID | unset → falls back to Google's demo iOS App ID (no iOS app exists in AdMob yet, and there's no `ios/` folder in this repo) |
| `EXPO_PUBLIC_ADS_ENABLED` | Master kill switch | unset → ads on |

Using the real Android App ID here is safe: only Google's TestIds are ever
requested (see `ADS_PRODUCTION_ENABLED` above), and an App ID by itself
identifies the app to AdMob, it doesn't serve or request any ad. This matches
Google's own quickstart, which has you put your real App ID in the manifest
before you have any real ad units.

## Why Expo Go can't show ads, and what "tested via Expo Go" means here

`react-native-google-mobile-ads` ships native Android/iOS code. Expo Go is a
fixed pre-built binary that only contains Expo's own SDK modules, so a custom
native module cannot run inside it - this is a hard platform limitation, not
a bug in this integration. Testing "via Expo Go" therefore verifies the app
*around* the ad code (auth, feed, navigation, everything else) is unaffected,
while the ad row itself renders nothing there by design. Seeing an actual
banner or native ad requires the native-rebuilt dev client or the sideloaded
release APK.

Confirmed on-device: launched via `pnpm run dev:mobile:usb` and opened in Expo
Go on the Reeder test device, the app boots and the feed scrolls with zero
errors in the Metro log, and no ad row/tile ever appears - matching the
expected no-op exactly, not a crash worked around.

## Rebuilding after a change

Whether `expo prebuild` is needed depends on what changed:

- **Native config changed** (App ID, the plugin itself, anything in
  `app.config.js`) - re-run prebuild, then Gradle:
  ```bash
  pnpm --filter @motionmeet/mobile exec expo prebuild -p android
  cd packages/mobile/android && ./gradlew assembleRelease
  ```
- **JS-only change** (ad frequency, tile layout, entitlement logic - anything
  under `src/`) - the existing `android/` project already has the native
  module linked; only the JS bundle needs rebuilding:
  ```bash
  cd packages/mobile/android && ./gradlew assembleRelease
  ```
  Clear the stale-bundle caches first if a previous build's JS keeps showing
  up (see `docs/mobile-qa-apk.md`) - Gradle's `UP-TO-DATE` check on the bundle
  task has been wrong before.

Then install/connect per `docs/mobile-qa-apk.md`.

## AdMob dashboard - manual steps still outstanding

Everything below stays your call; nothing here does it automatically:

1. **Android app** already exists in AdMob (`MotionMeet`, App ID
   `ca-app-pub-5742745881289950~9047244178`) - status "İnceleme gerekli"
   (needs review, normal pre-launch).
2. **iOS app**: not yet added. Add it from AdMob → Apps → Add app → iOS once
   you have an iOS bundle/App Store listing; you'll get a second, different
   App ID. Until then `EXPO_PUBLIC_ADMOB_IOS_APP_ID` stays on Google's demo
   value and no iOS build exists in this repo anyway.
3. **Production ad units** (Banner, Native): not created yet - deliberately
   left for you to do, since a unit's name/placement is a product decision.
   AdMob → Apps → MotionMeet → Ad units → Add ad unit. Once created, put the
   ids into `PRODUCTION_AD_UNITS` in `src/config/ads.ts` and flip
   `ADS_PRODUCTION_ENABLED` to `true` - only after you've decided to go live.
4. **Test device**: to see real (non-test-labeled) ad creatives on a
   specific physical device without risking invalid traffic, register it as
   a test device from the device's own logcat output (`Use RequestConfiguration.Builder().setTestDeviceIds(...)`
   or AdMob's own "Test devices" settings) - not needed for the current
   TestIds-only setup.
