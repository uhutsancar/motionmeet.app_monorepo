import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MediaViewerProps {
  /** The photo to show. Passing nothing closes the viewer. */
  uri: string | null;
  onClose: () => void;
  /** Read out to a screen reader in place of the picture. */
  accessibilityLabel?: string;
}

/**
 * A photo, full screen, and nothing else.
 *
 * This is the viewer a chat app opens when a picture in a conversation is
 * tapped: black behind, the photo scaled to fit whatever shape the screen is,
 * one close button, and no frame, card or container of any kind around the
 * image. `contain` rather than `cover` is the whole point — the viewer exists
 * to show the picture that was sent, so nothing may be cropped out of it, on
 * any aspect ratio.
 *
 * Tapping anywhere off the picture closes it too, which is the gesture people
 * reach for before they look for the button.
 */
const MediaViewer = ({ uri, onClose, accessibilityLabel }: MediaViewerProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (uri) setLoading(true);
  }, [uri]);

  return (
    <Modal
      visible={Boolean(uri)}
      animationType="fade"
      transparent={false}
      presentationStyle="fullScreen"
      hardwareAccelerated
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close', 'Kapat')}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.image}
              resizeMode="contain"
              onLoadEnd={() => setLoading(false)}
              accessibilityLabel={accessibilityLabel ?? t('common.photo', 'Fotoğraf')}
            />
          ) : null}
        </Pressable>

        {loading && (
          <View style={styles.spinner} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}

        <Pressable
          onPress={onClose}
          hitSlop={14}
          style={[styles.close, { top: Math.max(insets.top, 12) + 4 }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.close', 'Kapat')}
        >
          <Ionicons name="close" size={25} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  spinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    position: 'absolute',
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});

export default MediaViewer;
