/**
 * Extends the static app.json with values that can't live in plain JSON.
 *
 * Right now that's just the AdMob native App IDs: they're baked into
 * AndroidManifest.xml/Info.plist by the google-mobile-ads config plugin at
 * `expo prebuild` time, so they have to be resolved from env before the
 * plugin runs rather than read at JS runtime. See docs/mobile-admob.md.
 *
 * Both fall back to Google's own public sample App IDs so a prebuild never
 * fails - and never accidentally ships a real one - just because the env var
 * isn't set.
 */
const DEMO_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const DEMO_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || DEMO_ANDROID_APP_ID,
        iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || DEMO_IOS_APP_ID,
      },
    ],
  ],
});
