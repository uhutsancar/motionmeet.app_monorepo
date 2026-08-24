const { withStringsXml, AndroidConfig } = require('expo/config-plugins');

/**
 * Gives the localised permission strings a default-locale fallback.
 *
 * `expo.locales` exists for iOS, where it localises the `NS*UsageDescription`
 * keys in Info.plist. On Android the same file is written out as
 * `values-b+tr/strings.xml` — and nothing writes the untranslated originals, so
 * the app ships a Turkish string with no default behind it.
 *
 * Android's lint refuses a release build over this (`ExtraTranslation`), and it
 * is right to: a lookup from any other locale would find no resource and throw.
 * These are the English texts already declared for the same permissions in
 * `app.json`, so the two can never say different things about what the app
 * does with a permission.
 */
const DEFAULTS = {
  NSLocationWhenInUseUsageDescription:
    'MotionMeet uses your location to show athletes near you while the Nearby screen is open.',
  NSPhotoLibraryUsageDescription:
    'MotionMeet uses your selected photo only when you choose media to share or update your profile.',
  NSCameraUsageDescription:
    'MotionMeet uses your camera only when you choose to capture a workout photo.',
};

const withDefaultPermissionStrings = (config) =>
  withStringsXml(config, (stringsConfig) => {
    for (const [name, value] of Object.entries(DEFAULTS)) {
      stringsConfig.modResults = AndroidConfig.Strings.setStringItem(
        [{ $: { name }, _: value }],
        stringsConfig.modResults,
      );
    }
    return stringsConfig;
  });

module.exports = withDefaultPermissionStrings;
