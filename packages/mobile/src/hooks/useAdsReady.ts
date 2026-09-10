import { useEffect, useState } from 'react';
import { ensureAdsInitialized } from '../services/adsInit';

/**
 * True once consent has been resolved and the Mobile Ads SDK has finished
 * initializing. Ad surfaces gate on this instead of firing a request the
 * moment they mount, since requesting before `initialize()` resolves is the
 * one thing the SDK's own docs call out as unsafe.
 */
export const useAdsReady = (): boolean => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureAdsInitialized().then((ok) => {
      if (!cancelled) setReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
};
