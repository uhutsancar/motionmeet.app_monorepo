import React, { useCallback, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type TargetedEvent,
  type ViewStyle,
} from 'react-native';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';

interface KeyboardResponsiveViewProps extends React.PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  /**
   * Also avoid the keyboard on Android.
   *
   * Android normally resizes the window itself through adjustResize, which is
   * why this is off by default - screens that already scroll would otherwise be
   * adjusted twice. But a screen pinning something to the bottom of the window,
   * like the chat composer, has nothing to fall back on when the resize does not
   * happen: verified on a device, the composer sat behind the keyboard in both
   * Expo Go and the standalone build.
   *
   * `height` is inert when the window did resize, because the view's bottom edge
   * is already above the keyboard and the computed overlap is zero.
   */
  avoidOnAndroid?: boolean;
}

interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  avoidKeyboard?: boolean;
  extraScrollHeight?: number;
  onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
}

export const KeyboardResponsiveView = ({
  children,
  style,
  keyboardVerticalOffset = 0,
  avoidOnAndroid = false,
}: KeyboardResponsiveViewProps) => (
  <KeyboardAvoidingView
    style={style}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    enabled={Platform.OS === 'ios' || avoidOnAndroid}
    keyboardVerticalOffset={keyboardVerticalOffset}
  >
    {children}
  </KeyboardAvoidingView>
);

const isIOS = Platform.OS === 'ios';

/**
 * A ScrollView that keeps the focused input above the keyboard.
 *
 * iOS does this natively through automaticallyAdjustKeyboardInsets, so that is
 * all it gets. Wrapping it in a KeyboardAvoidingView on top used to pad by the
 * full keyboard height measured from the bottom of the screen, while the view
 * itself starts below the navigation header - the header height was counted
 * twice and threw the content far past the keyboard, hiding the very field the
 * user had tapped.
 *
 * Android is handled by `useKeyboardAwareScroll`: verified on a device, the
 * sign-in form moved 10px and the focused password field stayed under the
 * keyboard until the content was padded and scrolled by hand.
 */
const KeyboardAwareScrollView = React.forwardRef<ScrollView, KeyboardAwareScrollViewProps>(({
  avoidKeyboard = true,
  contentContainerStyle,
  extraScrollHeight = 20,
  onContentSizeChange,
  onFocus,
  ...props
}, forwardedRef) => {
  const localRef = useRef<ScrollView | null>(null);
  const { keyboardHeight, keyboardPadding, scheduleFocusedInputScroll } = useKeyboardAwareScroll(localRef, {
    extraScrollHeight,
  });
  const flattenedContentStyle = StyleSheet.flatten(contentContainerStyle) || {};
  const basePaddingBottom =
    typeof flattenedContentStyle.paddingBottom === 'number'
      ? flattenedContentStyle.paddingBottom
      : 0;

  const setRefs = useCallback((node: ScrollView | null) => {
    localRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  // iOS avoids through its native insets and Android through the padding
  // below; a KeyboardAvoidingView on top of either counts the keyboard twice.
  return (
    <ScrollView
      {...props}
      ref={setRefs}
      keyboardShouldPersistTaps={props.keyboardShouldPersistTaps || 'handled'}
      keyboardDismissMode={props.keyboardDismissMode || (isIOS ? 'interactive' : 'on-drag')}
      automaticallyAdjustKeyboardInsets={isIOS}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingBottom: basePaddingBottom + (avoidKeyboard ? keyboardPadding : 0) },
      ]}
      onFocus={(event) => {
        onFocus?.(event);
        scheduleFocusedInputScroll();
      }}
      onContentSizeChange={(contentWidth, contentHeight) => {
        onContentSizeChange?.(contentWidth, contentHeight);
        if (keyboardHeight > 0) scheduleFocusedInputScroll();
      }}
    />
  );
});

KeyboardAwareScrollView.displayName = 'KeyboardAwareScrollView';

export default KeyboardAwareScrollView;
