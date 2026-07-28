import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export const FullScreenModal = ({
  visible,
  onRequestClose,
  children,
  backgroundColor,
  animationType = 'slide',
}) => (
  <Modal
    visible={visible}
    animationType={animationType}
    transparent={false}
    presentationStyle="fullScreen"
    hardwareAccelerated
    statusBarTranslucent={false}
    navigationBarTranslucent={false}
    onRequestClose={onRequestClose}
  >
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
      <SafeAreaView
        style={[styles.flex, { backgroundColor }]}
        edges={['top', 'right', 'bottom', 'left']}
      >
        {children}
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>
);

export const BottomSheetModal = ({
  visible,
  onRequestClose,
  children,
  backgroundColor,
  heightRatio = 0.9,
  dismissOnBackdrop = true,
}) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maximumHeight = Math.max(0, height - insets.top - 12);
  const preferredHeight = Math.min(maximumHeight, Math.max(240, height * heightRatio));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      hardwareAccelerated
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          disabled={!dismissOnBackdrop}
          onPress={onRequestClose}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="box-none" style={styles.sheetPositioner}>
          <SafeAreaView
            edges={['right', 'bottom', 'left']}
            style={[
              styles.sheet,
              {
                height: preferredHeight,
                maxHeight: maximumHeight,
                backgroundColor,
              },
            ]}
          >
            {children}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetPositioner: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});
