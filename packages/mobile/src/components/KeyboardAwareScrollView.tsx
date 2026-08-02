import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type TargetedEvent,
  type ViewStyle,
  findNodeHandle,
} from 'react-native';

interface KeyboardResponsiveViewProps extends React.PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}

interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  avoidKeyboard?: boolean;
  extraScrollHeight?: number;
  keyboardVerticalOffset?: number;
  onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
}

const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const keyboardHideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

export const KeyboardResponsiveView = ({
  children,
  style,
  keyboardVerticalOffset = 0,
}: KeyboardResponsiveViewProps) => (
  <KeyboardAvoidingView
    style={style}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    enabled={Platform.OS === 'ios'}
    keyboardVerticalOffset={keyboardVerticalOffset}
  >
    {children}
  </KeyboardAvoidingView>
);

/**
 * A ScrollView that follows the platform's resized viewport and scrolls the
 * active input above the keyboard. Only the requested focus clearance is added
 * so iOS keyboard insets and Android adjustResize are never counted twice.
 */
const KeyboardAwareScrollView = React.forwardRef<ScrollView, KeyboardAwareScrollViewProps>(({
  avoidKeyboard = true,
  contentContainerStyle,
  extraScrollHeight = 20,
  keyboardVerticalOffset = 0,
  onContentSizeChange,
  onFocus,
  ...props
}, forwardedRef) => {
  const localRef = useRef<ScrollView | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
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

  const scrollFocusedInputIntoView = useCallback((target?: number | null) => {
    let nodeHandle = target;
    if (!nodeHandle) {
      const inputRef = TextInput.State.currentlyFocusedInput ? TextInput.State.currentlyFocusedInput() : null;
      nodeHandle = inputRef ? findNodeHandle(inputRef as any) : null;
    }
    if (!nodeHandle) return;

    const scrollResponder = localRef.current?.getScrollResponder();
    scrollResponder?.scrollResponderScrollNativeHandleToKeyboard?.(
      nodeHandle,
      extraScrollHeight,
      true,
    );
  }, [extraScrollHeight]);

  const scheduleFocusedInputScroll = useCallback((target?: number | null) => {
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
        automaticallyAdjustKeyboardInsets={false}
        contentContainerStyle={[
          contentContainerStyle,
          {
            paddingBottom:
              basePaddingBottom +
              (keyboardHeight > 0 ? extraScrollHeight : 0),
          },
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
