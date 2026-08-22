import { useCallback, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

/**
 * The measured size of a story frame.
 *
 * Overlay positions are fractions of the frame, so the composer and the viewer
 * have to agree on what the frame is down to the pixel. Window dimensions are
 * only the opening guess — what actually gets used is the laid-out size of the
 * view the story is drawn into, which is the same on both screens and stays
 * right through a rotation, a split screen or a device with a cutout.
 */
export const useStoryFrame = () => {
  const window = useWindowDimensions();
  const [frame, setFrame] = useState({ width: window.width, height: window.height });

  const onFrameLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width < 1 || height < 1) return;
    setFrame((current) =>
      Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
        ? current
        : { width, height },
    );
  }, []);

  return { frameWidth: frame.width, frameHeight: frame.height, onFrameLayout };
};
