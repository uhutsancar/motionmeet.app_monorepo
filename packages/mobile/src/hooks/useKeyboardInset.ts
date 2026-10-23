import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * A reported keyboard shorter than this is not one that covers anything.
 *
 * A floating or split IME still fires `keyboardDidShow`, with a height of a few
 * points. Treating that as "the keyboard is up" pushed content around for no
 * reason and, on Android, dropped the gutter that keeps buttons clear of the
 * gesture strip.
 */
const COVERS_SCREEN_ABOVE = 80;

const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

export interface KeyboardInset {
  /** How much of the screen's bottom edge the keyboard is covering, in points. */
  height: number;
  /** Whether a keyboard large enough to hide something is on screen. */
  visible: boolean;
}

/**
 * How far the keyboard reaches up the screen.
 *
 * Full-screen modals are the reason this exists. Neither platform resizes a
 * modal's window when the keyboard opens — Android's `adjustResize` applies to
 * the activity, not to the dialog a `Modal` is drawn in — so anything anchored
 * to the bottom of a modal sits behind the keyboard unless it is lifted by
 * hand. The story composer, the caption editor, the place picker and the reply
 * bar all read from here so they behave the same way on every screen size.
 *
 * The frame's `screenY` is measured rather than the reported `height`: on a
 * phone tested here the height came back 48pt short of the real keyboard,
 * because the suggestion strip above it was not counted.
 *
 * `screenY` is measured from the top of the physical screen, and Android runs
 * edge-to-edge, so content reaches the very bottom of the screen. The window
 * height Android reports leaves out the navigation bar, which left every lifted
 * field another 48pt short - the place input and its Add button sat half
 * under the keyboard. The screen height is what `screenY` is measured against.
 */
export const useKeyboardInset = (): KeyboardInset => {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const apply = (event: KeyboardEvent) => {
      const screenHeight = Dimensions.get(Platform.OS === 'android' ? 'screen' : 'window').height;
      const frame = event.endCoordinates;
      const covered = frame ? Math.max(0, screenHeight - frame.screenY) : 0;
      setHeight(covered < COVERS_SCREEN_ABOVE ? 0 : covered);
    };

    const onShow = Keyboard.addListener(SHOW_EVENT, apply);
    const onHide = Keyboard.addListener(HIDE_EVENT, () => setHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  return { height, visible: height > 0 };
};

export default useKeyboardInset;
