import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler,
  RotationGestureHandler,
  State,
  TapGestureHandler,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
  type PinchGestureHandlerStateChangeEvent,
  type RotationGestureHandlerStateChangeEvent,
  type TapGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
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

/** Half-width and height of the drop-to-delete target at the bottom centre. */
const TRASH_RADIUS_X = 92;
const TRASH_HEIGHT = 148;

/** A caption may be nudged to the very edge, but never off the frame. */
const MIN_FRACTION = 0.02;
const MAX_FRACTION = 0.98;

const RAD_TO_DEG = 180 / Math.PI;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/**
 * One caption the author can move, pinch, turn — or throw away.
 *
 * Every gesture is handled by the native gesture tree and drives `Animated`
 * nodes that live on the UI thread, so the caption tracks the finger at the
 * display's refresh rate instead of waiting on a JavaScript frame.
 *
 * Its position is owned here, in those same nodes. The committed fractions are
 * reported upward so the story can be published, but a drag never re-reads
 * position from props — which is what stops the caption snapping back for a
 * frame when the finger lifts. Where it is let go is where it stays.
 *
 * Positions travel as fractions of the frame, so the caption lands in the same
 * spot on a 5" phone, a tablet and the web.
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

  const panRef = useRef<PanGestureHandler>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);
  const rotationRef = useRef<RotationGestureHandler>(null);

  // The committed centre, in frame pixels. This — not the `overlay` prop — is
  // what the caption is drawn from, so committing never moves it.
  const baseX = useRef(new Animated.Value(overlay.x * frameWidth)).current;
  const baseY = useRef(new Animated.Value(overlay.y * frameHeight)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  const baseRotation = useRef(new Animated.Value((overlay.rotation * Math.PI) / 180)).current;
  const gestureRotation = useRef(new Animated.Value(0)).current;

  // Pinch is a live multiplier on top of the committed scale, and the committed
  // scale is what sets the real font size — so type stays crisp at 4× instead
  // of being a blown-up bitmap.
  const pinchScale = useRef(new Animated.Value(1)).current;

  const live = useRef({
    x: overlay.x * frameWidth,
    y: overlay.y * frameHeight,
    rotation: (overlay.rotation * Math.PI) / 180,
    scale: overlay.scale,
    overTrash: false,
  }).current;

  // Resetting the multiplier during the render that carries the new font size
  // puts both changes in one native batch, so the caption never flashes at the
  // wrong size between the finger lifting and the re-render landing.
  const appliedScale = useRef(overlay.scale);
  if (appliedScale.current !== overlay.scale) {
    appliedScale.current = overlay.scale;
    live.scale = overlay.scale;
    pinchScale.setValue(1);
  }

  // A rotation or a split screen changes the frame a caption was placed
  // against; the stored fractions are what stay true across that.
  const frameRef = useRef({ width: frameWidth, height: frameHeight });
  useEffect(() => {
    if (frameRef.current.width === frameWidth && frameRef.current.height === frameHeight) return;
    frameRef.current = { width: frameWidth, height: frameHeight };
    live.x = overlay.x * frameWidth;
    live.y = overlay.y * frameHeight;
    baseX.setValue(live.x);
    baseY.setValue(live.y);
  }, [baseX, baseY, frameHeight, frameWidth, live, overlay.x, overlay.y]);

  const commit = useCallback(() => {
    onCommit({
      ...overlay,
      x: clamp(live.x / Math.max(frameWidth, 1), MIN_FRACTION, MAX_FRACTION),
      y: clamp(live.y / Math.max(frameHeight, 1), MIN_FRACTION, MAX_FRACTION),
      scale: live.scale,
      rotation: live.rotation * RAD_TO_DEG,
    });
  }, [frameHeight, frameWidth, live, onCommit, overlay]);

  const onPanEvent = useMemo(
    () =>
      Animated.event<PanGestureHandlerGestureEvent>(
        [{ nativeEvent: { translationX: dragX, translationY: dragY } }],
        {
          useNativeDriver: true,
          // The bin only needs to know when the caption crosses into it, so
          // JavaScript is woken on that change rather than on every frame.
          listener: (event) => {
            const { translationX, translationY } = (
              event as unknown as PanGestureHandlerGestureEvent
            ).nativeEvent;
            const dropX = live.x + translationX;
            const dropY = live.y + translationY;
            const overTrash =
              dropY > frameHeight - TRASH_HEIGHT &&
              Math.abs(dropX - frameWidth / 2) < TRASH_RADIUS_X;
            if (overTrash !== live.overTrash) {
              live.overTrash = overTrash;
              onDragStateChange(true, overTrash);
            }
          },
        },
      ),
    [dragX, dragY, frameHeight, frameWidth, live, onDragStateChange],
  );

  const onPanStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, translationX, translationY } = event.nativeEvent;

      if (state === State.BEGAN) {
        live.overTrash = false;
        onDragStateChange(true, false);
        return;
      }

      if (oldState !== State.ACTIVE) {
        if (state === State.FAILED || state === State.CANCELLED) onDragStateChange(false, false);
        return;
      }

      onDragStateChange(false, false);

      if (live.overTrash) {
        live.overTrash = false;
        onDelete(overlay.id);
        return;
      }

      live.x = clamp(live.x + translationX, frameWidth * MIN_FRACTION, frameWidth * MAX_FRACTION);
      live.y = clamp(live.y + translationY, frameHeight * MIN_FRACTION, frameHeight * MAX_FRACTION);
      // These four writes are flushed to the native side in one batch, so the
      // caption does not blink back to where the drag started.
      baseX.setValue(live.x);
      baseY.setValue(live.y);
      dragX.setValue(0);
      dragY.setValue(0);
      commit();
    },
    [
      baseX,
      baseY,
      commit,
      dragX,
      dragY,
      frameHeight,
      frameWidth,
      live,
      onDelete,
      onDragStateChange,
      overlay.id,
    ],
  );

  const onPinchEvent = useMemo(
    () => Animated.event([{ nativeEvent: { scale: pinchScale } }], { useNativeDriver: true }),
    [pinchScale],
  );

  const onPinchStateChange = useCallback(
    (event: PinchGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.oldState !== State.ACTIVE) return;
      live.scale = clamp(
        live.scale * event.nativeEvent.scale,
        STORY_OVERLAY_LIMITS.minScale,
        STORY_OVERLAY_LIMITS.maxScale,
      );
      commit();
    },
    [commit, live],
  );

  const onRotationEvent = useMemo(
    () => Animated.event([{ nativeEvent: { rotation: gestureRotation } }], { useNativeDriver: true }),
    [gestureRotation],
  );

  const onRotationStateChange = useCallback(
    (event: RotationGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.oldState !== State.ACTIVE) return;
      live.rotation += event.nativeEvent.rotation;
      baseRotation.setValue(live.rotation);
      gestureRotation.setValue(0);
      commit();
    },
    [baseRotation, commit, gestureRotation, live],
  );

  const onTapStateChange = useCallback(
    (event: TapGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.state === State.ACTIVE) onEdit(overlay.id);
    },
    [onEdit, overlay.id],
  );

  const halfWidth = (size?.width ?? 0) / 2;
  const halfHeight = (size?.height ?? 0) / 2;

  const translateX = useMemo(
    () => Animated.subtract(Animated.add(baseX, dragX), halfWidth),
    [baseX, dragX, halfWidth],
  );
  const translateY = useMemo(
    () => Animated.subtract(Animated.add(baseY, dragY), halfHeight),
    [baseY, dragY, halfHeight],
  );
  const rotate = useMemo(
    () =>
      Animated.add(baseRotation, gestureRotation).interpolate({
        inputRange: [-Math.PI, Math.PI],
        outputRange: ['-180deg', '180deg'],
      }),
    [baseRotation, gestureRotation],
  );

  const onOverlayLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = event.nativeEvent.layout;
      setSize((current) =>
        current && Math.abs(current.width - width) <= 1 && Math.abs(current.height - height) <= 1
          ? current
          : { width, height },
      );
    },
    [],
  );

  return (
    <PanGestureHandler
      ref={panRef}
      simultaneousHandlers={[pinchRef, rotationRef]}
      minDist={2}
      onGestureEvent={onPanEvent}
      onHandlerStateChange={onPanStateChange}
    >
      <Animated.View
        onLayout={onOverlayLayout}
        style={[
          styles.overlay,
          {
            maxWidth: frameWidth * 0.88,
            // Hidden until measured so it cannot flash in the top-left corner
            // before it is centred on its anchor point.
            opacity: size ? 1 : 0,
            transform: [{ translateX }, { translateY }, { rotate }, { scale: pinchScale }],
          },
        ]}
      >
        <PinchGestureHandler
          ref={pinchRef}
          simultaneousHandlers={[panRef, rotationRef]}
          onGestureEvent={onPinchEvent}
          onHandlerStateChange={onPinchStateChange}
        >
          <Animated.View>
            <RotationGestureHandler
              ref={rotationRef}
              simultaneousHandlers={[panRef, pinchRef]}
              onGestureEvent={onRotationEvent}
              onHandlerStateChange={onRotationStateChange}
            >
              <Animated.View>
                <TapGestureHandler onHandlerStateChange={onTapStateChange} maxDist={8}>
                  <View>
                    <StoryOverlayView overlay={overlay} frameWidth={frameWidth} />
                  </View>
                </TapGestureHandler>
              </Animated.View>
            </RotationGestureHandler>
          </Animated.View>
        </PinchGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});

export default StoryDraggableOverlay;
