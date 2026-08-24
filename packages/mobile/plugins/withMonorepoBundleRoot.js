const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Points React Native's bundling task at the workspace root.
 *
 * The gradle plugin passes the entry file to the bundler as a path relative to
 * `react.root`, which defaults to the app package. Metro, meanwhile, has the
 * whole workspace as its server root — that is what lets the app import
 * `@motionmeet/shared`. The two disagree in a monorepo: gradle hands over
 * `index.ts`, Metro looks for it beside the *workspace* `package.json`, and a
 * release build dies with
 *
 *   Unable to resolve module ./index.ts from D:\motionmeet.app_monorepo/.
 *
 * even though `expo export` bundles the very same entry point without
 * complaint. Naming the workspace root here makes gradle send
 * `packages/mobile/index.ts`, which is what Metro is expecting.
 *
 * Debug builds never hit this: they load from the dev server and skip bundling
 * altogether, which is why it only ever appears when someone builds an APK.
 */
const MARKER = '// motionmeet:monorepo-bundle-root';

const withMonorepoBundleRoot = (config) =>
  withAppBuildGradle(config, (gradleConfig) => {
    const contents = gradleConfig.modResults.contents;
    if (contents.includes(MARKER)) return gradleConfig;

    // `file()` in android/app/build.gradle resolves against android/app, so
    // four levels up is the workspace root.
    const anchor = 'react {\n';
    const index = contents.indexOf(anchor);
    if (index === -1) return gradleConfig;

    const insertAt = index + anchor.length;
    gradleConfig.modResults.contents =
      `${contents.slice(0, insertAt)}    ${MARKER}\n    root = file("../../../..")\n${contents.slice(insertAt)}`;

    return gradleConfig;
  });

module.exports = withMonorepoBundleRoot;
