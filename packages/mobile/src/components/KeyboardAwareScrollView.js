import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  findNodeHandle,
} from 'react-native';

const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const keyboardHideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

export const KeyboardResponsiveView = ({
  children,
  style,
  keyboardVerticalOffset = 0,
}) => (
  <KeyboardAvoidingView
    style={style}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={keyboardVerticalOffset}
  >
    {children}
  </KeyboardAvoidingView>
);

/**
 * A ScrollView that both resizes for the keyboard and scrolls the active input
 * above it. The extra bottom room is important on Android devices whose IME is
 * taller than the viewport area left to the app.
 */
const KeyboardAwareScrollView = React.forwardRef(({
  avoidKeyboard = true,
  contentContainerStyle,
  extraScrollHeight = 20,
  keyboardVerticalOffset = 0,
  onContentSizeChange,
  onFocus,
  ...props
}, forwardedRef) => {
  const localRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flattenedContentStyle = StyleSheet.flatten(contentContainerStyle) || {};
  const basePaddingBottom =
    typeof flattenedContentStyle.paddingBottom === 'number'
      ? flattenedContentStyle.paddingBottom
      : 0;

  const setRefs = useCallback((node) => {
    localRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  const scrollFocusedInputIntoView = useCallback((target) => {
    const focusedInput =
      target ||
      TextInput.State.currentlyFocusedInput?.() ||
      TextInput.State.currentlyFocusedField?.();
    const nodeHandle =
      typeof focusedInput === 'number' ? focusedInput : findNodeHandle(focusedInput);
    if (!nodeHandle) return;

    const scrollResponder = localRef.current?.getScrollResponder?.();
    scrollResponder?.scrollResponderScrollNativeHandleToKeyboard?.(
      nodeHandle,
      extraScrollHeight,
      true,
    );
  }, [extraScrollHeight]);

  const scheduleFocusedInputScroll = useCallback((target) => {
    requestAnimationFrame(() => {
      setTimeout(() => scrollFocusedInputIntoView(target), Platform.OS === 'android' ? 80 : 20);
    });
  }, [scrollFocusedInputIntoView]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(keyboardShowEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
      scheduleFocusedInputScroll();
    });
    const hideSubscription = Keyboard.addListener(keyboardHideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scheduleFocusedInputScroll]);

  const scrollView = (
    <ScrollView
        {...props}
        ref={setRefs}
        keyboardShouldPersistTaps={props.keyboardShouldPersistTaps || 'handled'}
        keyboardDismissMode={props.keyboardDismissMode || (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[
          contentContainerStyle,
          {
            paddingBottom:
              basePaddingBottom +
              (keyboardHeight > 0 ? keyboardHeight + extraScrollHeight : 0),
          },
        ]}
        onFocus={(event) => {
          onFocus?.(event);
          scheduleFocusedInputScroll(event.target);
        }}
        onContentSizeChange={(contentWidth, contentHeight) => {
          onContentSizeChange?.(contentWidth, contentHeight);
          if (keyboardHeight > 0) scheduleFocusedInputScroll();
        }}
    />
  );

  if (!avoidKeyboard) return scrollView;

  return (
    <KeyboardResponsiveView
      style={styles.flex}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {scrollView}
    </KeyboardResponsiveView>
  );
});

KeyboardAwareScrollView.displayName = 'KeyboardAwareScrollView';

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default KeyboardAwareScrollView;
