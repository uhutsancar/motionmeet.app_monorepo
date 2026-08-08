import { useCallback, useRef, useState } from "react";

/**
 * Foreground-only access to the browser Geolocation API.
 *
 * Deliberately narrow: it asks once, on demand, and hands the reading straight
 * to the caller. There is no `watchPosition`, no background task and no
 * history — the app never learns where the member has been, only where they
 * are at the moment they open the Nearby page.
 *
 * Every way a reading can fail becomes a named outcome instead of an
 * exception, because each one needs a different sentence and a different
 * recovery action in the UI.
 */

export type LocationOutcome =
  | "granted"
  /** Declined this time; asking again is still allowed. */
  | "denied"
  /** Declined permanently for this origin. Only the browser's site settings can undo it. */
  | "blocked"
  /** The page is not on a secure origin, so the browser refuses to answer at all. */
  | "insecure_context"
  /** Permission held, but no fix could be produced. */
  | "unavailable"
  /** The fix took longer than a member will wait. */
  | "timeout";

export interface DeviceFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /**
   * `coarse` when the browser only produced a network-derived reading. Still
   * usable for a kilometre-scale radius, so it is reported rather than rejected.
   */
  source: "gps" | "coarse";
  timestamp: number;
}

export interface LocationResult {
  outcome: LocationOutcome;
  fix: DeviceFix | null;
}

/**
 * A reading beyond this is city-block accuracy at best, which is what
 * network-derived positioning produces. It is flagged so the backend can
 * record how the fix was obtained.
 */
const COARSE_ACCURACY_METERS = 2_000;
/** Longer than this and the page is just showing a spinner for nothing. */
const FIX_TIMEOUT_MS = 15_000;
/** A reading this fresh is reused rather than asking the browser again. */
const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;

const toFix = (position: GeolocationPosition): DeviceFix => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy ?? null,
  source: (position.coords.accuracy ?? 0) > COARSE_ACCURACY_METERS ? "coarse" : "gps",
  timestamp: position.timestamp,
});

const readPermissionState = async (): Promise<PermissionState | null> => {
  // Firefox has no Permissions entry for geolocation, so a missing answer is
  // normal and must not be read as a refusal.
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state;
  } catch {
    return null;
  }
};

export const useDeviceLocation = () => {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<LocationOutcome | null>(null);
  // Guards against a double click firing two permission prompts.
  const inFlight = useRef<Promise<LocationResult> | null>(null);

  const readPosition = useCallback(
    () =>
      new Promise<LocationResult>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          resolve({ outcome: "unavailable", fix: null });
          return;
        }
        // Browsers only expose geolocation on https (localhost excepted), and
        // fail with a bare permission error that would otherwise read as a
        // refusal by the member.
        if (typeof window !== "undefined" && window.isSecureContext === false) {
          resolve({ outcome: "insecure_context", fix: null });
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ outcome: "granted", fix: toFix(position) }),
          async (error) => {
            if (error.code === error.TIMEOUT) {
              resolve({ outcome: "timeout", fix: null });
              return;
            }
            if (error.code === error.PERMISSION_DENIED) {
              // A stored "denied" is a site setting the member has to undo;
              // a one-off dismissal can simply be asked again.
              const state = await readPermissionState();
              resolve({ outcome: state === "denied" ? "blocked" : "denied", fix: null });
              return;
            }
            resolve({ outcome: "unavailable", fix: null });
          },
          {
            // Nothing in the product resolves below a kilometre, so asking for
            // a finer fix would only cost battery and time.
            enableHighAccuracy: false,
            timeout: FIX_TIMEOUT_MS,
            maximumAge: LAST_KNOWN_MAX_AGE_MS,
          },
        );
      }),
    [],
  );

  const requestFix = useCallback(async (): Promise<LocationResult> => {
    if (inFlight.current) return inFlight.current;
    setBusy(true);
    const work = readPosition()
      .catch((): LocationResult => ({ outcome: "unavailable", fix: null }))
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

  /** Current permission state without triggering a prompt. */
  const checkPermission = useCallback(async (): Promise<LocationOutcome> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return "unavailable";
    if (typeof window !== "undefined" && window.isSecureContext === false) return "insecure_context";
    const state = await readPermissionState();
    if (state === "denied") return "blocked";
    if (state === "prompt") return "denied";
    // `granted`, or a browser that does not report the state at all (Firefox).
    // Guessing "denied" there would show every Firefox user a permission
    // warning they do not need, so the optimistic answer is the right default.
    return "granted";
  }, []);

  return { busy, outcome, requestFix, checkPermission };
};
