import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StoryOverlay } from '@motionmeet/shared';
import StoryOverlayView from './StoryOverlayView';

interface StoryOverlayAnchorProps {
  overlay: StoryOverlay;
  frameWidth: number;
  frameHeight: number;
}

/**
 * Places a finished overlay on a story exactly where the author left it.
 *
 * `x`/`y` describe the overlay's centre, so it is measured once and then pulled
 * back by half its own size — the same arithmetic the composer applies while
 * dragging, which is what makes the preview and the published story line up.
 */
const StoryOverlayAnchor = ({ overlay, frameWidth, frameHeight }: StoryOverlayAnchorProps) => {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  return (
    <View
      pointerEvents="none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (!size || Math.abs(size.width - width) > 1 || Math.abs(size.height - height) > 1) {
          setSize({ width, height });
        }
      }}
      style={[
        styles.anchor,
        {
          left: overlay.x * frameWidth,
          top: overlay.y * frameHeight,
          maxWidth: frameWidth * 0.88,
          opacity: size ? 1 : 0,
          transform: [
            { translateX: size ? -size.width / 2 : 0 },
            { translateY: size ? -size.height / 2 : 0 },
            { rotate: `${overlay.rotation}deg` },
          ],
        },
      ]}
    >
      <StoryOverlayView overlay={overlay} frameWidth={frameWidth} />
    </View>
  );
};

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
  },
});

export default StoryOverlayAnchor;
