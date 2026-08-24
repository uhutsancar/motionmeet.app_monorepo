const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Caps Android's two broad storage permissions at the last release that needed
 * them.
 *
 * Android 13 replaced `READ_EXTERNAL_STORAGE` with the granular
 * `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` pair, and Android 10 made
 * `WRITE_EXTERNAL_STORAGE` unnecessary for writing into the user's own photo
 * library. On anything modern the app asks only for the narrow permissions.
 *
 * They cannot simply be removed, though. The oldest devices this app supports
 * run Android 9, where there is no granular alternative: without
 * `READ_EXTERNAL_STORAGE` the photo picker has nothing to request and returns a
 * permanent refusal, so choosing a picture is impossible, and without
 * `WRITE_EXTERNAL_STORAGE` a share card cannot be saved to the gallery.
 *
 * `maxSdkVersion` is the way to have both: the permission exists on the
 * versions that need it and is absent everywhere else, which is what a store
 * listing and a privacy review both want to see.
 */
const CAPS = {
  'android.permission.READ_EXTERNAL_STORAGE': '32',
  'android.permission.WRITE_EXTERNAL_STORAGE': '29',
};

const withLegacyStoragePermissions = (config) =>
  withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];

    for (const [name, maxSdkVersion] of Object.entries(CAPS)) {
      const existing = manifest['uses-permission'].find(
        (entry) => entry.$?.['android:name'] === name,
      );
      if (existing) {
        existing.$['android:maxSdkVersion'] = maxSdkVersion;
      } else {
        manifest['uses-permission'].push({
          $: { 'android:name': name, 'android:maxSdkVersion': maxSdkVersion },
        });
      }
    }

    return manifestConfig;
  });

module.exports = withLegacyStoragePermissions;
