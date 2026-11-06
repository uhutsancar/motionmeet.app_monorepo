const { withGradleProperties } = require('expo/config-plugins');

/**
 * Keeps R8 off for release builds.
 *
 * The SDK 58 template turns `android.enableMinifyInReleaseBuilds` on. The first
 * APK built that way crashed at launch on the Reeder: R8 stripped Room's
 * generated `WorkDatabase_Impl`, so WorkManager's startup initializer threw
 * "Failed to create an instance of androidx.work.impl.WorkDatabase". Every
 * earlier release ran unminified; turning it on again needs the keep rules
 * tested on a device first.
 */
const withReleaseMinifyOff = (config) =>
  withGradleProperties(config, (gradleConfig) => {
    const key = 'android.enableMinifyInReleaseBuilds';
    const existing = gradleConfig.modResults.find((item) => item.type === 'property' && item.key === key);
    if (existing) existing.value = 'false';
    else gradleConfig.modResults.push({ type: 'property', key, value: 'false' });
    return gradleConfig;
  });

module.exports = withReleaseMinifyOff;
