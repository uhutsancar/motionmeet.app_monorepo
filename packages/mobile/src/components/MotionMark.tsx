import React, { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * The MotionMeet mark: one unbroken stroke that draws an M and, read again, two
 * strides. It is the single brand mark — the launcher icon, the splash, the web
 * favicon, the share cards and this component are all the same drawing, so the
 * geometry below must stay in step with `brand/motionmeet-mark.svg` (see
 * `scripts/generate-brand-assets.mjs`, which renders every raster from it).
 *
 * `variant="glyph"` drops the tile for places that already sit on a dark
 * surface, such as a header that should not show a second rounded square.
 */
interface MotionMarkProps {
  size?: number;
  variant?: 'tile' | 'glyph';
}

/** The mark's own colours, exported so a lockup can tint its wordmark to match. */
export const MOTION_MARK_COLORS = Object.freeze({
  start: '#3B82F6',
  middle: '#2FA9F4',
  end: '#22D3EE',
});

const MotionMark = ({ size = 44, variant = 'tile' }: MotionMarkProps) => {
  // Gradient ids are global to the SVG renderer on Android, so two marks on one
  // screen would otherwise share whichever definition mounted last.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tile = `mmTile${uid}`;
  const stroke = `mmStroke${uid}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="MotionMeet">
      <Defs>
        <LinearGradient id={tile} x1="40" y1="0" x2="472" y2="512" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#141C2E" />
          <Stop offset="0.5" stopColor="#0D1424" />
          <Stop offset="1" stopColor="#070B15" />
        </LinearGradient>
        <LinearGradient id={stroke} x1="96" y1="128" x2="416" y2="384" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={MOTION_MARK_COLORS.start} />
          <Stop offset="0.55" stopColor={MOTION_MARK_COLORS.middle} />
          <Stop offset="1" stopColor={MOTION_MARK_COLORS.end} />
        </LinearGradient>
      </Defs>

      {variant === 'tile' && <Rect width="512" height="512" rx="116" fill={`url(#${tile})`} />}

      <Path
        d="M112 380V166l144 138 144-138v214"
        fill="none"
        stroke={`url(#${stroke})`}
        strokeWidth="62"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default memo(MotionMark);
