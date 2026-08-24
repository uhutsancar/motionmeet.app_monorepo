import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appConfig = JSON.parse(await readFile(path.join(repositoryRoot, 'packages', 'mobile', 'app.json'), 'utf8')).expo;
const failures = [];

if (appConfig.android?.allowBackup !== false) failures.push('android.allowBackup must be false');
if (!appConfig.android?.package) failures.push('android.package is required');
if (!appConfig.ios?.bundleIdentifier) failures.push('ios.bundleIdentifier is required');

const imagePicker = (appConfig.plugins ?? []).find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker');
if (!imagePicker || imagePicker[1]?.microphonePermission !== false) failures.push('expo-image-picker microphone permission must be disabled');

const explicitPermissions = new Set(appConfig.android?.permissions ?? []);
for (const permission of ['android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.RECORD_AUDIO']) {
  if (explicitPermissions.has(permission)) failures.push(`dangerous explicit permission: ${permission}`);
}

const blockedPermissions = new Set(appConfig.android?.blockedPermissions ?? []);

/**
 * Android's two broad storage permissions must never ship uncapped.
 *
 * They used to be blocked outright, which is the strongest possible position
 * and was right while nothing needed them. It stopped being right once the app
 * had to read the photo library on Android 9 — where there is no granular
 * alternative and the picker simply returns a permanent refusal without
 * `READ_EXTERNAL_STORAGE` — and had to write a share card to the gallery, which
 * needs `WRITE_EXTERNAL_STORAGE` before scoped storage arrived in Android 10.
 *
 * `withLegacyStoragePermissions` caps both with `maxSdkVersion`, so they exist
 * only on the releases that have no other way and are absent on everything
 * modern. This check enforces that arrangement: either the permission is
 * blocked, or the plugin that caps it is installed. What it will not allow is
 * the permission being declared with no ceiling at all.
 */
const CAPPED_STORAGE_PLUGIN = './plugins/withLegacyStoragePermissions';
const capsLegacyStorage = (appConfig.plugins ?? []).includes(CAPPED_STORAGE_PLUGIN);
for (const permission of ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']) {
  if (!blockedPermissions.has(permission) && !capsLegacyStorage) {
    failures.push(
      `legacy storage permission must be blocked or capped by ${CAPPED_STORAGE_PLUGIN}: ${permission}`,
    );
  }
}

console.log(JSON.stringify({
  androidPackage: appConfig.android?.package,
  iosBundleIdentifier: appConfig.ios?.bundleIdentifier,
  allowBackup: appConfig.android?.allowBackup,
  blockedPermissions: [...blockedPermissions],
  legacyStorageCappedByPlugin: capsLegacyStorage,
  microphonePermission: imagePicker?.[1]?.microphonePermission,
  failures,
}, null, 2));
if (failures.length) throw new Error(`Mobile config security check failed: ${failures.join('; ')}`);
