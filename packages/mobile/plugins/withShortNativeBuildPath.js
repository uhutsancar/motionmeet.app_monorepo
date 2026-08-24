const path = require('node:path');
const { withSettingsGradle } = require('expo/config-plugins');

/**
 * Moves CMake's object files off the deep pnpm path, on Windows.
 *
 * CMake refuses to place an object file whose full path is longer than 250
 * characters (`CMAKE_OBJECT_PATH_MAX`), and its default staging directory is
 * `.cxx` inside the library's own folder — which, in a pnpm workspace, already
 * costs over 200 characters before the file name:
 *
 *   node_modules/.pnpm/react-native-screens@4.16.0_0c3f31635a9ece83b6469…/
 *     node_modules/react-native-screens/android/.cxx/RelWithDebInfo/…
 *
 * The build does not say so. ninja rewrites its manifest, never settles, and
 * fails with "manifest 'build.ninja' still dirty after 100 tries", which
 * mentions neither paths nor the module at fault.
 *
 * The staging directory is the only part that can be moved. A library's
 * *generated* C++ sources cannot: React Native's autolinking writes their
 * absolute paths into `Android-autolinking.cmake` as
 * `<library>/android/build/generated/source/codegen/jni`, so relocating a
 * module's Gradle build directory only produces a second copy that nothing
 * reads. Keeping those paths short is `.npmrc`'s job — see
 * `virtual-store-dir-max-length` there.
 *
 * The root must be on the same drive as the repository: the codegen task
 * relativises the schema it writes against the module's own directory, and a
 * relative path cannot cross drives ("this and base files have different
 * roots"). `MOTIONMEET_BUILD_DIR` overrides the location; by default it is
 * `.mmbuild` at the top of the repository's own drive.
 *
 * Linux and macOS never reach the limit, so this is a no-op there.
 */
const MARKER = '// motionmeet:short-build-path';

const withShortNativeBuildPath = (config) =>
  withSettingsGradle(config, (gradleConfig) => {
    if (process.platform !== 'win32') return gradleConfig;
    if (gradleConfig.modResults.contents.includes(MARKER)) return gradleConfig;

    const drive = path.parse(path.resolve(gradleConfig.modRequest.projectRoot)).root;
    const root = (process.env.MOTIONMEET_BUILD_DIR || path.join(drive, '.mmbuild'))
      .split(path.sep)
      .join('/');

    gradleConfig.modResults.contents += [
      '',
      '',
      MARKER,
      '// CMake caps an object file at 250 characters and a pnpm path spends most of',
      '// that before the file name; see plugins/withShortNativeBuildPath.js.',
      '//',
      '// This runs in settings.gradle because the Android plugin reads the staging',
      '// directory while it configures a module, so a subprojects block in the root',
      '// build file is already too late.',
      'gradle.beforeProject { project ->',
      "  ['com.android.library', 'com.android.application'].each { pluginId ->",
      '    project.plugins.withId(pluginId) {',
      "      project.extensions.configure('android') { androidExtension ->",
      '        androidExtension.externalNativeBuild.cmake.buildStagingDirectory =',
      `          new File("${root}/cxx/" + project.name)`,
      '      }',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    return gradleConfig;
  });

module.exports = withShortNativeBuildPath;
