import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const MotionMark = ({ size = 44 }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="MotionMeet">
    <Defs>
      <LinearGradient id="mmTile" x1="8" y1="6" x2="55" y2="58" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#18213A" />
        <Stop offset="1" stopColor="#0B1020" />
      </LinearGradient>
      <LinearGradient id="mmPulse" x1="15" y1="16" x2="50" y2="48" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#C8F768" />
        <Stop offset="0.5" stopColor="#8B7CFF" />
        <Stop offset="1" stopColor="#FF7468" />
      </LinearGradient>
    </Defs>
    <Rect x="3" y="3" width="58" height="58" rx="18" fill="url(#mmTile)" />
    <Rect x="3.75" y="3.75" width="56.5" height="56.5" rx="17.25" stroke="rgba(255,255,255,.12)" strokeWidth="1.5" />
    <Path
      d="M16.5 39.5V25.25C16.5 20.69 20.19 17 24.75 17C29.31 17 33 20.69 33 25.25V38.75C33 43.31 36.69 47 41.25 47C45.81 47 49.5 43.31 49.5 38.75V24.5"
      stroke="url(#mmPulse)"
      strokeWidth="6.5"
      strokeLinecap="round"
      fill="none"
    />
    <Circle cx="49.5" cy="17.5" r="3.5" fill="#C8F768" />
  </Svg>
);

export default MotionMark;
