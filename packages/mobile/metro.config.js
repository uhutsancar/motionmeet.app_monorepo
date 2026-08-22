const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const monorepoRoot = path.resolve(__dirname, '../..');
const sharedPkg = path.resolve(monorepoRoot, 'packages/shared');

// Only watch the packages relevant to the mobile app.
// By default Metro would watch the entire monorepo root which increases
// file-map creation time significantly (10 MB+ on this workspace).
config.watchFolders = [sharedPkg, path.resolve(monorepoRoot, 'node_modules')];

// Keep Metro's resolver aware of the workspace root so it can find
// hoisted node_modules, without watching the entire tree.
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
  ],
};

/**
 * Turns an absolute directory into a separator-agnostic anchored pattern.
 *
 * The excludes below have to be anchored to a known root. An unanchored
 * `/[\\/]dist[\\/]/` would also block the `dist` folder that most packages in
 * node_modules publish their code from, and the app would stop resolving.
 */
const anchor = (absoluteDirectory) => absoluteDirectory
  .split(/[\\/]/)
  .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('[\\\\/]');

const projectRoot = anchor(__dirname);
const workspaceRoot = anchor(monorepoRoot);

// getDefaultConfig ships its own entries (.expo/types, __tests__). Assigning
// over the whole property used to drop them.
const expoDefaults = [config.resolver.blockList].flat().filter(Boolean);

/**
 * Metro crawls the project root on top of `watchFolders`, and this package is
 * also where the native build tree lands. Left in the file map, a cold start
 * spent minutes stat-ing and hashing well over a gigabyte of gradle and CMake
 * output before the first bundle could even start - on Expo Go that looks like
 * the app simply never loading.
 *
 * Everything excluded here is gitignored build output or another workspace
 * package; nothing the app imports lives in any of it.
 */
config.resolver.blockList = [
  ...expoDefaults,
  // Native build tree: android/build, app/build, .gradle, .cxx and friends.
  new RegExp(`^${projectRoot}[\\\\/]android([\\\\/]|$)`),
  // Output of previous `expo export` runs: dist/, dist-android/, dist-ios/...
  new RegExp(`^${projectRoot}[\\\\/]dist(-[\\w-]+)?[\\\\/]`),
  // Other workspace packages. The app never imports them, and leaving them
  // resolvable produces a second copy of anything they share with it.
  /[\\/]packages[\\/](?!mobile[\\/]|shared[\\/])[^\\/]+[\\/]/,
  // Repo-level caches and tooling.
  new RegExp(
    `^${workspaceRoot}[\\\\/](\\.git|\\.github|\\.turbo|\\.pnpm-store|scripts|docs|tools)([\\\\/]|$)`,
  ),
  // Gradle and CMake write their output *inside* the node_modules copy of every
  // native module they build, so `expo run:android` leaves well over a gigabyte
  // of build artifacts in the pnpm store - expo-modules-core/android/build
  // alone is 1.1 GB. Metro crawled and watched all of it on every start.
  /[\\/]android[\\/](build|\.cxx|\.gradle)([\\/]|$)/,
  /[\\/]ios[\\/](build|Pods)([\\/]|$)/,
  // react-native ships its iOS/Android sources next to its JS. Libraries/ and
  // src/ hold the code the bundle needs; none of these do.
  /[\\/]react-native[\\/](ReactAndroid|ReactCommon|React|sdks|template|third-party-podspecs)([\\/]|$)/,
  // The debugger UI is served off disk by @react-native/dev-middleware and the
  // gradle plugin only ever runs under Gradle. Both are blocked one level in,
  // so each package.json stays resolvable and only the bulk disappears.
  /[\\/]@react-native[\\/]debugger-frontend[\\/]dist([\\/]|$)/,
  /[\\/]@react-native[\\/]gradle-plugin[\\/](build|src)([\\/]|$)/,
];

// Expo SDK 54 resolves the workspace root and the app-relative entry point for
// monorepos. Overriding unstable_serverRoot makes `expo export` prepend
// packages/mobile twice and prevents the release bundle from resolving index.ts.

config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

/**
 * Crawl node_modules, but do not watch it.
 *
 * Without watchman installed - and it is not, on any of our machines - Metro
 * falls back to a watcher that opens one `fs.watch` handle per directory. The
 * pnpm store under the workspace root is ~11k directories after the blockList
 * above, and on Windows each handle costs a couple of milliseconds, so simply
 * starting the watcher took 30-60 s. Past 240 s metro-file-map gives up with
 * "Failed to start watch mode." and the bundler never comes up at all.
 *
 * Nothing in node_modules changes while the dev server runs; it only changes on
 * `pnpm install`, which means a restart anyway. So the tree still gets crawled
 * (the resolver needs every file in its map) and is simply left unwatched.
 * Measured on this workspace: watcher startup 29.9 s -> 1.7 s.
 *
 * Set METRO_WATCH_NODE_MODULES=1 to opt back in when editing a dependency in
 * place, e.g. while debugging a patch-package change.
 *
 * `roots` is swapped only for the duration of the watch() call because crawl()
 * has already run by then and reads the same array.
 */
if (process.env.METRO_WATCH_NODE_MODULES !== '1') {
  try {
    // pnpm keeps metro-file-map out of this package's node_modules, so follow
    // the same dependency chain Metro itself resolves through.
    let req = require;
    for (const pkg of ['expo', '@expo/metro-config', 'metro']) {
      req = require('node:module').createRequire(req.resolve(`${pkg}/package.json`));
    }
    const { Watcher } = req('metro-file-map/private/Watcher');
    const originalWatch = Watcher.prototype.watch;
    if (typeof originalWatch !== 'function') {
      throw new Error('Watcher.prototype.watch is missing');
    }
    const isNodeModulesRoot = (root) => /[\\/]node_modules$/.test(root);

    Watcher.prototype.watch = function watch(onChange) {
      const allRoots = this._options.roots;
      const restore = () => {
        this._options.roots = allRoots;
      };
      this._options.roots = allRoots.filter((root) => !isNodeModulesRoot(root));
      return originalWatch.call(this, onChange).then(
        (result) => {
          restore();
          return result;
        },
        (error) => {
          restore();
          throw error;
        },
      );
    };
  } catch (error) {
    // A Metro upgrade can move this internal. Losing the optimisation is a slow
    // dev server; throwing here would be no dev server at all.
    console.warn(
      `metro.config.js: could not skip watching node_modules (${error.message}). ` +
        'Startup will be slower.',
    );
  }
}

module.exports = config;
