import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

const clamp = (value, minimum, maximum) =>
  Math.min(Math.max(value, minimum), maximum);

/**
 * Keeps layout decisions based on the usable content width instead of a
 * particular phone model. Font scale is included so large accessibility text
 * gets the same room as a physically narrow screen.
 */
export const useResponsiveLayout = ({
  maxContentWidth = 720,
  minTwoColumnWidth = 520,
} = {}) => {
  const { width, height, fontScale } = useWindowDimensions();

  return useMemo(() => {
    const horizontalPadding = width < 360 ? 12 : width < 600 ? 16 : 20;
    const boundedWidth = Math.min(width, maxContentWidth);
    const contentWidth = Math.max(0, boundedWidth - horizontalPadding * 2);
    const prefersSingleColumn =
      contentWidth < minTwoColumnWidth || fontScale > 1.2;

    return {
      width,
      height,
      fontScale,
      horizontalPadding,
      contentWidth,
      isNarrow: contentWidth < 340 || fontScale > 1.25,
      isPhone: width < 600,
      columns: prefersSingleColumn ? 1 : 2,
      columnGap: clamp(Math.round(contentWidth * 0.025), 8, 14),
    };
  }, [fontScale, height, maxContentWidth, minTwoColumnWidth, width]);
};

