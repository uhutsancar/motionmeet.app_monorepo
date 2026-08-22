import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { StoryOverlay } from '@motionmeet/shared';
import {
  storyBackdropStyle,
  storyBaseFontSize,
  storyFont,
  storyTextColor,
  storyTextTransform,
} from './storyTypography';

interface StoryOverlayViewProps {
  overlay: StoryOverlay;
  /** Width of the story frame; every size is derived from it. */
  frameWidth: number;
}

/**
 * Draws one caption or location sticker exactly as it was composed.
 *
 * The composer and the viewer share this component on purpose: what the author
 * positions is pixel-for-pixel what a viewer sees, on any screen, because the
 * only device-dependent input is the frame width.
 */
const StoryOverlayView = ({ overlay, frameWidth }: StoryOverlayViewProps) => {
  const font = storyFont(overlay.font);
  const fontSize = storyBaseFontSize(frameWidth) * overlay.scale;
  const color = storyTextColor(overlay);
  const backdrop = storyBackdropStyle(overlay, overlay.color);
  const isLocation = overlay.kind === 'location';

  if (isLocation) {
    return (
      <View style={[styles.locationPill, { paddingHorizontal: fontSize * 0.42, paddingVertical: fontSize * 0.22 }]}>
        <Ionicons name="location" size={fontSize * 0.78} color="#101014" />
        <Text
          numberOfLines={2}
          style={{
            color: '#101014',
            fontSize,
            fontWeight: '800',
            letterSpacing: 0.2,
            textTransform: 'uppercase',
          }}
        >
          {overlay.text}
        </Text>
      </View>
    );
  }

  return (
    <View style={[backdrop, backdrop ? { paddingHorizontal: fontSize * 0.28, paddingVertical: fontSize * 0.1 } : null]}>
      <Text
        style={[
          font.style,
          {
            color,
            fontSize,
            lineHeight: fontSize * 1.22,
            textAlign: overlay.align,
            textTransform: storyTextTransform(font),
          },
          // A soft glow for Neon, and a readability shadow for everything else
          // so white type survives a bright photo.
          font.glow
            ? { textShadowColor: overlay.color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: fontSize * 0.5 }
            : backdrop
              ? null
              : { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
        ]}
      >
        {overlay.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
});

export default memo(StoryOverlayView);
