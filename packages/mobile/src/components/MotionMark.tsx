import React, { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * The MotionMeet mark: two athletes reaching toward each other over a shared
 * pulse, whose silhouette reads as an M. It is the single brand mark — the
 * launcher icon, the splash, the web favicon and this component are all
 * rendered from `brand/motionmeet-mark.svg`, so the geometry below must stay in
 * step with that file (see `scripts/generate-brand-assets.mjs`).
 *
 * `variant="glyph"` drops the tile for places that already sit on a dark
 * surface, such as a header that should not show a second rounded square.
 */
interface MotionMarkProps {
  size?: number;
  variant?: 'tile' | 'glyph';
}

const MotionMark = ({ size = 44, variant = 'tile' }: MotionMarkProps) => {
  // Gradient ids are global to the SVG renderer on Android, so two marks on one
  // screen would otherwise share whichever definition mounted last.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tile = `mmTile${uid}`;
  const left = `mmLeft${uid}`;
  const right = `mmRight${uid}`;
  const pulse = `mmPulse${uid}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="MotionMeet">
      <Defs>
        <LinearGradient id={tile} x1="40" y1="0" x2="460" y2="512" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#7215EA" />
          <Stop offset="0.45" stopColor="#2A0D7C" />
          <Stop offset="1" stopColor="#08061F" />
        </LinearGradient>
        <LinearGradient id={left} x1="104" y1="120" x2="240" y2="400" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#F86FE8" />
          <Stop offset="1" stopColor="#9757FB" />
        </LinearGradient>
        <LinearGradient id={right} x1="408" y1="120" x2="272" y2="400" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#6B8CFF" />
          <Stop offset="1" stopColor="#8F62FB" />
        </LinearGradient>
        <LinearGradient id={pulse} x1="180" y1="384" x2="332" y2="258" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#28E7F7" />
          <Stop offset="1" stopColor="#0C9BFF" />
        </LinearGradient>
      </Defs>

      {variant === 'tile' && <Rect width="512" height="512" rx="118" fill={`url(#${tile})`} />}

      <Path
        d="M126 198 100 348q-4 44 40 46 40 2 58-34l40-70Z"
        fill="none"
        stroke={`url(#${left})`}
        strokeWidth="50"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M386 198l26 150q4 44-40 46-40 2-58-34l-40-70Z"
        fill="none"
        stroke={`url(#${right})`}
        strokeWidth="50"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="136" cy="146" r="38" fill={`url(#${left})`} />
      <Circle cx="376" cy="146" r="38" fill={`url(#${right})`} />
      <Path
        d="M180 370h26l16-26 16 40 18-122 18 122 16-40 16 26h26"
        fill="none"
        stroke={`url(#${pulse})`}
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export default memo(MotionMark);
