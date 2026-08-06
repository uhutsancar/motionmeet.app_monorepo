import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

interface ResponsiveLayoutOptions {
  maxContentWidth?: number;
  minTwoColumnWidth?: number;
}

/**
 * Keeps layout decisions based on the usable content width instead of a
 * particular phone model. Font scale is included so large accessibility text
 * gets the same room as a physically narrow screen.
 */
export const useResponsiveLayout = ({
  maxContentWidth = 720,
  minTwoColumnWidth = 520,
}: ResponsiveLayoutOptions = {}) => {
  const { width, height, fontScale } = useWindowDimensions();
  const {
    top: insetTop,
    right: insetRight,
    bottom: insetBottom,
    left: insetLeft,
  } = useSafeAreaInsets();

  return useMemo(() => {
    const usableWidth = Math.max(0, width - insetLeft - insetRight);
    const horizontalPadding = usableWidth < 360 ? 12 : usableWidth < 600 ? 16 : 20;
    const boundedWidth = Math.min(usableWidth, maxContentWidth);
    const contentWidth = Math.max(0, boundedWidth - horizontalPadding * 2);
    const prefersSingleColumn =
      contentWidth < minTwoColumnWidth || fontScale > 1.2;

    return {
      width,
      height,
      fontScale,
      usableWidth,
      horizontalPadding,
      contentWidth,
      // 360dp phones (the most common Android width) still fit side-by-side
      // rows, so only genuinely small screens or large text get the stacked
      // layout.
      isNarrow: contentWidth < 300 || fontScale > 1.25,
      isPhone: width < 600,
      isCompactHeight: height - insetTop - insetBottom < 640,
      columns: prefersSingleColumn ? 1 : 2,
      columnGap: clamp(Math.round(contentWidth * 0.025), 8, 14),
    };
  }, [
    fontScale,
    height,
    insetBottom,
    insetLeft,
    insetRight,
    insetTop,
    maxContentWidth,
    minTwoColumnWidth,
    width,
  ]);
};
