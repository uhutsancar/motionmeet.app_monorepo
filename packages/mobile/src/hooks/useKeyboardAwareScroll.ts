import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, Platform, TextInput, findNodeHandle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isIOS = Platform.OS === 'ios';

interface KeyboardScrollResponder {
  scrollResponderScrollNativeHandleToKeyboard?: (
    nodeHandle: number,
    additionalOffset?: number,
    preventNegativeScrollOffset?: boolean,
  ) => void;
}

/** A ScrollView or a FlatList: both hand out the native scroll responder. */
export interface KeyboardScrollTarget {
  getScrollResponder: () => unknown;
  getNativeScrollRef?: () => unknown;
}

interface MeasurableView {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
}

interface Options {
  /** Space kept between the focused field and the keyboard's top edge. */
  extraScrollHeight?: number;
  /**
   * Follow only the fields that ask for it through `requestFocusedInputScroll`.
   *
   * For a screen whose own list holds a few inputs but which also opens
   * modals with theirs - the feed under the post and story composers. A
   * keyboard raised by a modal must not pad or scroll the list behind it.
   */
  onlyWhenRequested?: boolean;
}

/**
 * Keeps the focused text field of a scrolling screen above the keyboard on
 * Android.
 *
 * Android runs edge-to-edge (`edgeToEdgeEnabled` in gradle.properties, the
 * Expo SDK 54 default), and an edge-to-edge window is not resized for the
 * keyboard: `adjustResize` has no effect. So the scroller is given the
 * keyboard's height as extra bottom padding while it is open - room to lift
 * the last field - and is then scrolled until the focused field sits above
 * the keyboard top. The keyboard event reports its height without the system
 * navigation bar under it, so the bar's height is added to the gap; without
 * it a field ended flush against the keyboard with its bottom border hidden.
 *
 * iOS adjusts its own insets (`automaticallyAdjustKeyboardInsets`) and gets
 * nothing from here. Shared by `KeyboardAwareScrollView` and by lists whose
 * rows hold an input, like a post's inline comment box in the feed.
 */
export const useKeyboardAwareScroll = (
  scrollRef: RefObject<KeyboardScrollTarget | null>,
  { extraScrollHeight = 20, onlyWhenRequested = false }: Options = {},
) => {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const requested = useRef(false);
  const keyboardGap = extraScrollHeight + (isIOS ? 0 : insets.bottom);

  const scrollFocusedInputIntoView = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput ? TextInput.State.currentlyFocusedInput() : null;
    // The focused input and findNodeHandle's parameter are the same host
    // instance at runtime; React Native types them as unrelated shapes, so
    // the hop through unknown is what the compiler needs to accept it.
    const nodeHandle = input ? findNodeHandle(input as unknown as Parameters<typeof findNodeHandle>[0]) : null;
    if (!nodeHandle) return;
    const responder = scrollRef.current?.getScrollResponder() as KeyboardScrollResponder | null | undefined;
    if (!responder?.scrollResponderScrollNativeHandleToKeyboard) return;
    /*
     * React Native places the field against the keyboard as if the scroller
     * began at the top of the screen: it compares the field's offset inside
     * the content with the keyboard's screen position. Below a header that
     * left the field short by the header's height - verified on the feed,
     * where the comment box stopped half under the keyboard. The scroller's
     * own top on screen is added to the gap so the two are measured alike.
     */
    const host = scrollRef.current?.getNativeScrollRef?.() as MeasurableView | null | undefined;
    if (host?.measureInWindow) {
      host.measureInWindow((_x, top) => {
        responder.scrollResponderScrollNativeHandleToKeyboard?.(nodeHandle, keyboardGap + Math.max(0, top), true);
      });
    } else {
      responder.scrollResponderScrollNativeHandleToKeyboard(nodeHandle, keyboardGap, true);
    }
  }, [keyboardGap, scrollRef]);

  const scheduleFocusedInputScroll = useCallback(() => {
    if (isIOS || (onlyWhenRequested && !requested.current)) return;
    requestAnimationFrame(() => {
      setTimeout(scrollFocusedInputIntoView, 80);
    });
  }, [onlyWhenRequested, scrollFocusedInputIntoView]);

  /** Called from a row's input `onFocus` when only requested fields are followed. */
  const requestFocusedInputScroll = useCallback(() => {
    requested.current = true;
    scheduleFocusedInputScroll();
  }, [scheduleFocusedInputScroll]);

  useEffect(() => {
    if (isIOS) return undefined;
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      if (onlyWhenRequested && !requested.current) return;
      setKeyboardHeight(event.endCoordinates?.height || 0);
      scheduleFocusedInputScroll();
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      requested.current = false;
      setKeyboardHeight(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [onlyWhenRequested, scheduleFocusedInputScroll]);

  return {
    keyboardHeight,
    /** Extra bottom padding for the scroller's content while the keyboard is open. */
    keyboardPadding: !isIOS && keyboardHeight > 0 ? keyboardHeight + keyboardGap : 0,
    scheduleFocusedInputScroll,
    requestFocusedInputScroll,
  };
};
