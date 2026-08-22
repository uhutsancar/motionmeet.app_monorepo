import React, { memo, useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface StoryRingProps {
  size: number;
  /** A dimmed grey ring marks a story the viewer has already opened. */
  seen?: boolean;
  thickness?: number;
}

/**
 * The ring around a story bubble.
 *
 * It is drawn as an SVG gradient rather than a plain border so an unread story
 * carries the brand's own pink-to-blue sweep — the same three colours as the
 * app mark — instead of a flat accent line.
 */
const StoryRing = ({ size, seen = false, thickness = 2.5 }: StoryRingProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `storyRing${uid}`;
  const radius = (size - thickness) / 2;

  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
          {(seen
            ? [
                { offset: '0', color: '#3A3F47' },
                { offset: '1', color: '#2A2E35' },
              ]
            : [
                { offset: '0', color: '#F86FE8' },
                { offset: '0.5', color: '#9757FB' },
                { offset: '1', color: '#28E7F7' },
              ]
          ).map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </LinearGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={thickness}
      />
    </Svg>
  );
};

export default memo(StoryRing);
