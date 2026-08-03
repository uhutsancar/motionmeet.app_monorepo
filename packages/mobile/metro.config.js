const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const monorepoRoot = path.resolve(__dirname, '../..');
const sharedPkg = path.resolve(monorepoRoot, 'packages/shared');

// Only watch the packages relevant to the mobile app.
// By default Metro would watch the entire monorepo root which increases
// file-map creation time significantly (10 MB+ on this workspace).
config.watchFolders = [sharedPkg];

// Keep Metro's resolver aware of the workspace root so it can find
// hoisted node_modules, without watching the entire tree.
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
  ],
};

// Exclude heavy directories that Metro does not need to watch.
// Metro accepts a RegExp or an array of RegExps as blockList.
config.resolver.blockList = [
  // Ignore all other packages to avoid duplicate module resolution.
  /packages[/\\](?!mobile|shared)[/\\].*/,
  // Ignore CI, documentation, and build artifacts at the repo root.
  /[/\\](\.git|\.github|scripts|docker|\.turbo)[/\\]/,
];

// Expo SDK 54 resolves the workspace root and the app-relative entry point for
// monorepos. Overriding unstable_serverRoot makes `expo export` prepend
// packages/mobile twice and prevents the release bundle from resolving index.ts.

module.exports = config;
