import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import type { StoryOverlay } from '@motionmeet/shared';
import { STORY_OVERLAY_LIMITS } from '@motionmeet/shared';
import StoryOverlayView from './StoryOverlayView';

interface StoryDraggableOverlayProps {
  overlay: StoryOverlay;
  frameWidth: number;
  frameHeight: number;
  /** Fired continuously while a finger is down, so the frame can show the bin. */
  onDragStateChange: (dragging: boolean, overTrash: boolean) => void;
  onCommit: (overlay: StoryOverlay) => void;
  onDelete: (overlayId: string) => void;
  onEdit: (overlayId: string) => void;
}

/** Distance a finger may travel before a touch stops counting as a tap. */
const TAP_SLOP = 6;
/** Half-width and height of the drop-to-delete target at the bottom centre. */
const TRASH_RADIUS_X = 92;
const TRASH_HEIGHT = 148;

const distance = (event: GestureResponderEvent): number => {
  const [first, second] = event.nativeEvent.touches;
  if (!first || !second) return 0;
  return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
};

const angle = (event: GestureResponderEvent): number => {
  const [first, second] = event.nativeEvent.touches;
  if (!first || !second) return 0;
  return (Math.atan2(second.pageY - first.pageY, second.pageX - first.pageX) * 180) / Math.PI;
};

/**
 * One caption the author can move, pinch, turn — or throw away.
 *
 * Position is held as a fraction of the frame rather than in points, so the
 * caption lands where it was left no matter which screen the story is opened
 * on. Dropping it over the bin at the bottom of the frame deletes it, which is
 * the gesture people already know from Instagram.
 */
const StoryDraggableOverlay = ({
  overlay,
  frameWidth,
  frameHeight,
  onDragStateChange,
  onCommit,
  onDelete,
  onEdit,
}: StoryDraggableOverlayProps) => {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;

  // Gesture bookkeeping lives in refs so the responder can stay stable across
  // renders instead of being rebuilt on every frame of a drag.
  const state = useRef({
    startDistance: 0,
    startAngle: 0,
    startScale: overlay.scale,
    startRotation: overlay.rotation,
    liveScale: overlay.scale,
    liveRotation: overlay.rotation,
    moved: false,
    overTrash: false,
  }).current;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          state.moved = false;
          state.overTrash = false;
          state.startScale = state.liveScale;
          state.startRotation = state.liveRotation;
          state.startDistance = 0;
          pan.setValue({ x: 0, y: 0 });
          onDragStateChange(true, false);
        },
        onPanResponderMove: (event, gesture) => {
          if (event.nativeEvent.touches.length >= 2) {
            const spread = distance(event);
            const turn = angle(event);
            if (!state.startDistance) {
              state.startDistance = spread;
              state.startAngle = turn;
            } else if (spread > 0) {
              const next = Math.min(
                STORY_OVERLAY_LIMITS.maxScale,
                Math.max(STORY_OVERLAY_LIMITS.minScale, (state.startScale * spread) / state.startDistance),
              );
              state.liveScale = next;
              state.liveRotation = state.startRotation + (turn - state.startAngle);
              scale.setValue(next / overlay.scale);
            }
            return;
          }

          if (Math.abs(gesture.dx) > TAP_SLOP || Math.abs(gesture.dy) > TAP_SLOP) state.moved = true;
          pan.setValue({ x: gesture.dx, y: gesture.dy });

          const dropY = overlay.y * frameHeight + gesture.dy;
          const dropX = overlay.x * frameWidth + gesture.dx;
          const overTrash =
            dropY > frameHeight - TRASH_HEIGHT && Math.abs(dropX - frameWidth / 2) < TRASH_RADIUS_X;
          if (overTrash !== state.overTrash) {
            state.overTrash = overTrash;
            onDragStateChange(true, overTrash);
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          onDragStateChange(false, false);

          if (!state.moved && state.liveScale === overlay.scale) {
            pan.setValue({ x: 0, y: 0 });
            onEdit(overlay.id);
            return;
          }

          if (state.overTrash) {
            onDelete(overlay.id);
            return;
          }

          // Clamped so a caption can be nudged to the edge but never pushed
          // out of the frame where nobody could reach it again.
          const x = Math.min(0.96, Math.max(0.04, overlay.x + gesture.dx / frameWidth));
          const y = Math.min(0.94, Math.max(0.06, overlay.y + gesture.dy / frameHeight));
          pan.setValue({ x: 0, y: 0 });
          scale.setValue(1);
          onCommit({ ...overlay, x, y, scale: state.liveScale, rotation: state.liveRotation });
        },
        onPanResponderTerminate: () => {
          onDragStateChange(false, false);
          pan.setValue({ x: 0, y: 0 });
          scale.setValue(1);
        },
      }),
    // The responder reads live values from `state`, so it only needs rebuilding
    // when the overlay identity or the frame it is measured against changes.
    [frameHeight, frameWidth, onCommit, onDelete, onDragStateChange, onEdit, overlay, pan, scale, state],
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (!size || Math.abs(size.width - width) > 1 || Math.abs(size.height - height) > 1) {
          setSize({ width, height });
        }
      }}
      style={[
        styles.overlay,
        {
          left: overlay.x * frameWidth,
          top: overlay.y * frameHeight,
          maxWidth: frameWidth * 0.88,
          // Hidden until measured so it cannot flash in the top-left corner
          // before it is centred on its anchor point.
          opacity: size ? 1 : 0,
          transform: [
            { translateX: size ? -size.width / 2 : 0 },
            { translateY: size ? -size.height / 2 : 0 },
            { translateX: pan.x },
            { translateY: pan.y },
            { rotate: `${overlay.rotation}deg` },
            { scale },
          ],
        },
      ]}
    >
      <View pointerEvents="none">
        <StoryOverlayView overlay={overlay} frameWidth={frameWidth} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
  },
});

export default StoryDraggableOverlay;
