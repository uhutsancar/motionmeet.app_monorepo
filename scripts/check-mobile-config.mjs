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
for (const permission of ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']) {
  if (!blockedPermissions.has(permission)) failures.push(`legacy storage permission must remain blocked: ${permission}`);
}

console.log(JSON.stringify({
  androidPackage: appConfig.android?.package,
  iosBundleIdentifier: appConfig.ios?.bundleIdentifier,
  allowBackup: appConfig.android?.allowBackup,
  blockedPermissions: [...blockedPermissions],
  microphonePermission: imagePicker?.[1]?.microphonePermission,
  failures,
}, null, 2));
if (failures.length) throw new Error(`Mobile config security check failed: ${failures.join('; ')}`);
