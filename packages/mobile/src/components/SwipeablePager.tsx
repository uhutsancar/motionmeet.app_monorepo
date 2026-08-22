import React, { useEffect, useRef } from 'react';
import PagerView from 'react-native-pager-view';
import type { SwipeablePagerProps } from './SwipeablePager.types';

/**
 * A horizontally swipeable set of panes, driven by a controlled page index.
 *
 * `react-native-pager-view` reaches into React Native's codegen internals, which
 * react-native-web cannot resolve — importing it anywhere in the graph fails the
 * whole web bundle. So it is confined to this file, and `SwipeablePager.web.tsx`
 * provides the browser implementation. Nothing else in the app imports the
 * library directly.
 */
const SwipeablePager = ({ page, onPageChange, style, children }: SwipeablePagerProps) => {
  const pagerRef = useRef<PagerView>(null);
  // Tracks what the pager itself last reported, so a change that came from a
  // swipe is not immediately re-issued to the pager as a programmatic jump.
  const reportedPage = useRef(page);

  useEffect(() => {
    if (reportedPage.current === page) return;
    reportedPage.current = page;
    pagerRef.current?.setPage(page);
  }, [page]);

  return (
    <PagerView
      ref={pagerRef}
      style={[{ flex: 1 }, style]}
      initialPage={page}
      onPageSelected={(event) => {
        const { position } = event.nativeEvent;
        reportedPage.current = position;
        onPageChange(position);
      }}
    >
      {children}
    </PagerView>
  );
};

export default SwipeablePager;
