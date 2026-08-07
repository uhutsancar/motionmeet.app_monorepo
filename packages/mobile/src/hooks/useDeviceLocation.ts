import { useCallback, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

/**
 * Foreground-only access to the device GPS.
 *
 * Deliberately narrow: it asks for "while using the app", takes one reading on
 * demand, and hands it straight to the caller. There is no watcher, no
 * background task and no history - the app never learns where the member has
 * been, only where they are at the moment they open the Nearby screen.
 *
 * Every way a reading can fail is turned into a named outcome instead of an
 * exception, because each one needs a different sentence and a different
 * recovery action in the UI.
 */

export type LocationOutcome =
  | 'granted'
  /** Declined this time; asking again is still allowed. */
  | 'denied'
  /** Declined permanently, or restricted by policy. Only Settings can undo it. */
  | 'blocked'
  /** Location services are switched off for the whole device. */
  | 'services_off'
  /** Permission held, but the hardware produced no fix. */
  | 'unavailable'
  /** The fix took longer than a member will wait. */
  | 'timeout';

export interface DeviceFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /**
   * `coarse` when iOS Precise Location is off or Android granted approximate
   * only. Still usable for a kilometre-scale radius, so it is reported rather
   * than rejected.
   */
  source: 'gps' | 'coarse';
  timestamp: number;
}

export interface LocationResult {
  outcome: LocationOutcome;
  fix: DeviceFix | null;
}

/**
 * A reading beyond this is city-block accuracy at best, which is what reduced
 * or network-derived permissions produce. It is flagged so the backend can
 * record how the fix was obtained.
 */
const COARSE_ACCURACY_METERS = 2_000;
/** Longer than this and the screen is just showing a spinner for nothing. */
const FIX_TIMEOUT_MS = 15_000;
/** A reading this fresh is reused rather than waking the GPS again. */
const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;

const withTimeout = async <T>(work: Promise<T>, milliseconds: number): Promise<T | 'timeout'> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), milliseconds);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const toFix = (position: Location.LocationObject): DeviceFix => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy ?? null,
  source: (position.coords.accuracy ?? 0) > COARSE_ACCURACY_METERS ? 'coarse' : 'gps',
  timestamp: position.timestamp,
});

export const useDeviceLocation = () => {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<LocationOutcome | null>(null);
  // Guards against a double tap firing two permission dialogs on Android.
  const inFlight = useRef<Promise<LocationResult> | null>(null);

  const readPosition = useCallback(async (): Promise<LocationResult> => {
    // The OS dialog is only shown when the app has never asked, or asked and
    // was told "ask me next time"; the caller shows its own explanation first.
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      const blocked = !permission.canAskAgain || permission.status === Location.PermissionStatus.DENIED && Platform.OS === 'ios';
      return { outcome: blocked ? 'blocked' : 'denied', fix: null };
    }

    if (!(await Location.hasServicesEnabledAsync())) {
      return { outcome: 'services_off', fix: null };
    }

    // A recent reading avoids spinning the radio up again when the member
    // navigates back to the screen a minute later.
    const cached = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null);
    if (cached) return { outcome: 'granted', fix: toFix(cached) };

    // Balanced accuracy is roughly one city block. Nothing in the product
    // resolves below a kilometre, so asking for a finer fix would only cost
    // battery and time.
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
      FIX_TIMEOUT_MS,
    );
    if (position === 'timeout') return { outcome: 'timeout', fix: null };
    if (!position) return { outcome: 'unavailable', fix: null };
    return { outcome: 'granted', fix: toFix(position) };
  }, []);

  const requestFix = useCallback(async (): Promise<LocationResult> => {
    if (inFlight.current) return inFlight.current;
    setBusy(true);
    const work = readPosition()
      .catch((): LocationResult => ({ outcome: 'unavailable', fix: null }))
      .then((result) => {
        setOutcome(result.outcome);
        return result;
      })
      .finally(() => {
        setBusy(false);
        inFlight.current = null;
      });
    inFlight.current = work;
    return work;
  }, [readPosition]);

  /** Current permission state without triggering a dialog. */
  const checkPermission = useCallback(async (): Promise<LocationOutcome> => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) return permission.canAskAgain ? 'denied' : 'blocked';
      return (await Location.hasServicesEnabledAsync()) ? 'granted' : 'services_off';
    } catch {
      return 'unavailable';
    }
  }, []);

  const openSettings = useCallback(async () => {
    await Linking.openSettings().catch(() => undefined);
  }, []);

  return { busy, outcome, requestFix, checkPermission, openSettings };
};
