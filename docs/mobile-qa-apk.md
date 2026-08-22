# Building a sideloadable QA APK

A release APK refuses to boot unless it was bundled with an API origin, and it
refuses a plaintext one unless that origin is loopback or a private LAN address
— see `packages/mobile/src/config/environment.ts`. On top of that, Android's own
network security config only permits cleartext to `127.0.0.1`, `localhost` and
`10.0.2.2` (`packages/mobile/plugins/withLoopbackCleartext.js`).

So a build that talks to a backend on the developer's machine points at
**loopback on the device** and reaches the real server through `adb reverse`.
The same APK then works on an emulator and on a USB-attached phone, with no LAN
address baked in and no firewall rule needed.

## Build

Put the origins in `packages/mobile/.env.local` — it is gitignored, and it is
the only place Expo reliably picks them up. Exporting them in the shell that
runs Gradle is **not** enough: they never reach the Metro transform, and the
build then produces a bundle that crashes on the config guard as though nothing
had been set.

```bash
cat > packages/mobile/.env.local <<'EOF'
EXPO_PUBLIC_API_URL=http://127.0.0.1:4000
EXPO_PUBLIC_WEB_URL=http://127.0.0.1:5173
EXPO_PUBLIC_ALLOW_INSECURE_LAN=true
EOF

cd packages/mobile/android && ./gradlew assembleRelease
```

The APK lands in `app/build/outputs/apk/release/app-release.apk`.

Delete `.env.local` when you are done. A store build made while it is present
would be pointed at loopback and would pass every guard on the way out.

## Changing the origins

`EXPO_PUBLIC_*` values are inlined into the JS bundle by Babel, and **neither
Gradle nor Metro treats them as an input**. Editing a value and rebuilding
silently reuses the old bundle. Clear both caches whenever the origins change:

```bash
rm -rf packages/mobile/android/app/build/generated/assets/createBundleReleaseJsAndAssets \
       packages/mobile/android/app/build/generated/res/createBundleReleaseJsAndAssets
rm -rf "$TEMP/metro-cache"          # %TEMP%\metro-cache on Windows
```

Then check what actually landed before shipping the APK:

```bash
grep -c '127.0.0.1:4000' \
  packages/mobile/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle
```

## Install and connect

```bash
adb -s <serial> install -r app/build/outputs/apk/release/app-release.apk
adb -s <serial> reverse tcp:4000 tcp:4000
```

The reverse tunnel is per connection: re-run it after replugging the phone, or
after the emulator restarts. Without it every request fails with "Network
Error" while the app itself opens normally.

## Not for release

This configuration is for local device testing only. It is signed with the
checked-in debug keystore and it carries plaintext origins, which the app warns
about on boot. A build for real members needs HTTPS origins and a release
keystore of its own.
