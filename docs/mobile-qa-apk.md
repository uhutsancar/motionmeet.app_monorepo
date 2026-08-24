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

Put the origins in the **workspace root** `.env.local` — it is gitignored, and
it is where the release bundler reads dotenv from, because `react.root` points
at the workspace (see `plugins/withMonorepoBundleRoot.js`). A copy in
`packages/mobile/.env.local` is ignored by the release build. Exporting the
values in the shell that runs Gradle is **not** enough either: they never reach
the Metro transform, and the build then produces a bundle that crashes on the
config guard as though nothing had been set.

Only `EXPO_PUBLIC_*` names are inlined, so nothing else in the file reaches the
app.

```bash
cat > .env.local <<'EOF'
EXPO_PUBLIC_API_URL=http://127.0.0.1:4000
EXPO_PUBLIC_WEB_URL=http://127.0.0.1:5173
EXPO_PUBLIC_ALLOW_INSECURE_LAN=true
EOF

cd packages/mobile/android && ./gradlew assembleRelease
```

The APK lands in `app/build/outputs/apk/release/app-release.apk`.

### On Windows

Two extra things are needed, and both are handled by config plugins rather than
by hand — `pnpm exec expo prebuild -p android` applies them:

* **Paths have to stay under 260 characters**, in two places. ninja and CMake
  both use the plain Win32 APIs and ignore the OS long-path switch, and neither
  failure names a path: ninja says "Filename longer than 260 characters", CMake
  says "manifest 'build.ninja' still dirty after 100 tries".
  - CMake's object files are moved out of `node_modules` by
    `plugins/withShortNativeBuildPath.js`, into `<drive>:/.mmbuild/cxx`
    (`MOTIONMEET_BUILD_DIR` overrides it).
  - A library's *generated* C++ sources cannot be moved: autolinking writes
    their absolute paths into `Android-autolinking.cmake` as
    `<library>/android/build/generated/…`. The workspace `.npmrc` shortens the
    pnpm store instead — `virtual-store-dir=node_modules/.p` and
    `virtual-store-dir-max-length=30`, worth about 60 characters. Both settings
    are load-bearing for the Android build; changing them means re-checking
    that a release APK still links.
* **The bundler is told where the workspace is.** Gradle passes the entry file
  relative to `react.root`, which defaults to the app package, while Metro
  resolves against the workspace root — so a release build fails with "Unable to
  resolve module ./index.ts" even though `expo export` bundles the same entry
  without complaint. `plugins/withMonorepoBundleRoot.js` points `react.root` at
  the workspace.

`metro-runtime` is a direct devDependency of the workspace for the same family
of reasons: the app uses dynamic `import()`, whose runtime helper Metro resolves
from the *workspace* root, and pnpm does not expose a transitive dependency
there.

Check what landed before shipping, with `strings` — the bundle is Hermes
bytecode, so a plain `grep` for the origin finds nothing either way:

```bash
python -c "print(open('packages/mobile/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle','rb').read().count(b'127.0.0.1:4000'))"
```

A zero means the origins did not reach the bundle and the APK will fail its
config guard on launch.

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
