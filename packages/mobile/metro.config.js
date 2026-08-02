const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Expo SDK 54 resolves the workspace root and the app-relative entry point for
// monorepos. Overriding unstable_serverRoot makes `expo export` prepend
// packages/mobile twice and prevents the release bundle from resolving index.ts.

module.exports = config;
