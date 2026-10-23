import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/** Prefix of the workout card files WorkoutShareSheet writes to the cache. */
export const SHARE_CARD_FILE_PREFIX = 'motionmeet-card-';

/**
 * Deletes every rendered workout card from the app cache.
 *
 * Cards carry a member's name and training numbers, so they go when that
 * member signs out rather than waiting for the OS to evict them. Best effort:
 * a file that cannot be removed is left for the OS, never an error.
 */
export const clearShareCardCache = async (): Promise<void> => {
  if (Platform.OS === 'web' || !FileSystem.cacheDirectory) return;
  try {
    const names = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    await Promise.all(
      names
        .filter((name) => name.startsWith(SHARE_CARD_FILE_PREFIX))
        .map((name) => FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${name}`, { idempotent: true })),
    );
  } catch {
    // The cache directory is the OS's to clean up as well.
  }
};
