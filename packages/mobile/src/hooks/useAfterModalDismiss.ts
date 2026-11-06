import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Only a backstop: `onDismiss` is the real signal and arrives well before. */
const DISMISS_FALLBACK_MS = 1000;

/**
 * Runs a callback once a native modal has really left the screen.
 *
 * iOS animates a modal out and will not present or dismiss another controller
 * until that animation is over. Closing the story composer, the share sheet
 * under it and the navigator that owns both in one tick left a frozen
 * snapshot of the share sheet - card, buttons and all - on top of whatever
 * screen came next, chat included. Android dialogs have no such transition,
 * so the callback runs straight away there.
 *
 * Pass `onDismiss` to the modal being closed and `schedule` what should
 * happen after it.
 */
export const useAfterModalDismiss = () => {
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDismiss = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const run = pending.current;
    pending.current = null;
    run?.();
  }, []);

  const schedule = useCallback((run: () => void) => {
    if (Platform.OS !== 'ios') {
      run();
      return;
    }
    pending.current = run;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onDismiss, DISMISS_FALLBACK_MS);
  }, [onDismiss]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
  }, []);

  return { schedule, onDismiss };
};
