import { useCallback, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * Whether a screen's content has scrolled away from the top.
 *
 * The header uses it to fade its hairline in only once content is passing
 * under it: at rest the header and the page are one surface, and the edge
 * appears when there is something to separate. State changes only when the
 * threshold is crossed, so scrolling does not re-render the screen.
 */
export const useScrollEdge = (threshold = 4) => {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = event.nativeEvent.contentOffset.y > threshold;
    setScrolled((current) => (current === past ? current : past));
  }, [threshold]);
  return { scrolled, onScroll, scrollEventThrottle: 32 } as const;
};

export default useScrollEdge;
