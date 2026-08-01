const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Expo defaults this to the workspace root in a monorepo, while the native
// Gradle task passes the entry file relative to this app. Keep both roots
// aligned so release embedding resolves packages/mobile/index.ts correctly.
config.server.unstable_serverRoot = __dirname;

module.exports = config;
