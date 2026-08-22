import React, { Children, useEffect, useRef, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import type { SwipeablePagerProps } from './SwipeablePager.types';

/**
 * The browser implementation of {@link SwipeablePager}.
 *
 * `react-native-pager-view` is native-only — it imports React Native's codegen
 * internals, which react-native-web cannot resolve — so the web build gets a
 * paged horizontal ScrollView instead. It behaves the same from the outside:
 * panes can be dragged through, and the active index stays controlled.
 */
const SwipeablePager = ({ page, onPageChange, style, children }: SwipeablePagerProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  // Mirrors the native pager: a change that came from a drag is not echoed back
  // as a programmatic scroll.
  const reportedPage = useRef(page);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - width) > 1) setWidth(next);
  };

  useEffect(() => {
    if (!width || reportedPage.current === page) return;
    reportedPage.current = page;
    scrollRef.current?.scrollTo({ x: page * width, animated: true });
  }, [page, width]);

  // A resize would otherwise leave the visible pane halfway between two frames.
  useEffect(() => {
    if (!width) return;
    scrollRef.current?.scrollTo({ x: page * width, animated: false });
    // Only the width is watched here: `page` is handled by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onLayout={onLayout}
      onMomentumScrollEnd={(event) => {
        if (!width) return;
        const next = Math.round(event.nativeEvent.contentOffset.x / width);
        if (next === reportedPage.current) return;
        reportedPage.current = next;
        onPageChange(next);
      }}
      style={[{ flex: 1 }, style]}
    >
      {Children.map(children, (child, index) => (
        <View key={index} style={{ width: width || '100%' }}>
          {child}
        </View>
      ))}
    </ScrollView>
  );
};

export default SwipeablePager;
