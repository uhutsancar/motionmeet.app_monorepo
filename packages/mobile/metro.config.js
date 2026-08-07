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
];

// Expo SDK 54 resolves the workspace root and the app-relative entry point for
// monorepos. Overriding unstable_serverRoot makes `expo export` prepend
// packages/mobile twice and prevents the release bundle from resolving index.ts.

config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
