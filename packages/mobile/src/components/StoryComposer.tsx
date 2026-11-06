import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createOperationId, type Story, type StoryOverlay } from '@motionmeet/shared';
import { useAuthContext } from '../context/AuthProvider';
import { createStory } from '../api/endpoints';
import { isUploadCancelled, uploadMedia } from '../api/mediaUpload';
import { useAppSelector } from '../store/hooks';
import { useStoryFrame } from '../hooks/useStoryFrame';
import { FINGER_AT_REST } from './story/StoryDraggableOverlay';
import { ensureMediaLibraryPermission } from '../utils/permissions';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showSuccess,
} from '../utils/feedback';
import StoryDraggableOverlay from './story/StoryDraggableOverlay';
import StoryLocationSheet from './story/StoryLocationSheet';
import StoryTextEditor from './story/StoryTextEditor';

interface StoryComposerProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** iOS: called once the modal has finished animating away. */
  onDismiss?: () => void;
  /**
   * A picture to start from instead of opening the gallery, such as a
   * workout card. The author still adds text, moves things and decides
   * whether to post; the picture can be swapped like any other.
   */
  initialMedia?: ImagePickerAsset | null;
}

interface StoryVideoPreviewProps {
  uri: string;
}

const StoryVideoPreview = ({ uri }: StoryVideoPreviewProps) => {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      surfaceType="textureView"
      accessibilityLabel="Story video"
    />
  );
};

let overlaySequence = 0;
const nextOverlayId = (): string => `draft-${Date.now()}-${(overlaySequence += 1)}`;

const newTextOverlay = (): StoryOverlay => ({
  id: nextOverlayId(),
  kind: 'text',
  text: '',
  x: 0.5,
  y: 0.42,
  scale: 1,
  rotation: 0,
  font: 'classic',
  color: '#FFFFFF',
  align: 'center',
  backdrop: 'none',
});

/**
 * The story composer.
 *
 * Opening it goes straight to the photo roll — there is no blank canvas to fill
 * in first, because a story here always starts from something you shot. Once a
 * picture is chosen, captions and a place sticker are laid on top of it, and
 * what the author drags into place is exactly what a viewer sees: overlays are
 * stored as fractions of the frame, so the same story reads identically on
 * every screen size.
 */
/** The bin's circle, the room its label takes, and how near the finger must come. */
const TRASH_SIZE = 58;
const TRASH_LABEL_ALLOWANCE = 24;
const TRASH_HIT = 64;

const StoryComposer = ({ visible, onClose, onSuccess, onDismiss, initialMedia }: StoryComposerProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { frameWidth, frameHeight, onFrameLayout } = useStoryFrame();
  const { getToken } = useAuthContext();
  const user = useAppSelector((state) => state.user.value);

  const [media, setMedia] = useState<ImagePickerAsset | null>(null);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Percent of the file sent, while the upload itself is running; null otherwise.
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  // Set only while bytes are moving, so closing the composer then cancels the
  // native transfer instead of leaving it running behind a closed screen.
  const uploadAbortRef = useRef<AbortController | null>(null);

  const operationIdRef = useRef(createOperationId('story'));
  const uploadedRef = useRef<{ signature: string; key: string } | null>(null);
  // Guards the picker against being launched twice while its sheet animates in.
  const pickerBusyRef = useRef(false);
  // True once the gallery has been offered for the current opening.
  const launchedRef = useRef(false);

  const reset = useCallback(() => {
    setMedia(null);
    setOverlays([]);
    setEditingId(null);
    setLocationOpen(false);
    setDragging(false);
    operationIdRef.current = createOperationId('story');
    uploadedRef.current = null;
  }, []);

  const close = useCallback(() => {
    // During the upload, closing means "stop": the transfer is cancelled. Once
    // the story is being created the request is short and idempotent, so the
    // composer waits for it rather than leaving its outcome unreported.
    if (publishing && !uploadAbortRef.current) return;
    uploadAbortRef.current?.abort();
    reset();
    onClose();
  }, [onClose, publishing, reset]);

  const pickMedia = useCallback(async ({ closeOnCancel }: { closeOnCancel: boolean }) => {
    if (pickerBusyRef.current) return;
    pickerBusyRef.current = true;
    try {
      // A refusal is never final: the button asks again next time, and only a
      // permanent block sends the member to the OS settings.
      const permission = await ensureMediaLibraryPermission();
      if (!permission.granted) {
        if (permission.outcome === 'denied') {
          showError(t('common.error'), t('feed.permission_required_media'));
        }
        if (closeOnCancel) close();
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.85,
        videoMaxDuration: 60,
      });

      if (result.canceled || !result.assets[0]) {
        if (closeOnCancel) close();
        return;
      }

      setMedia(result.assets[0]);
      uploadedRef.current = null;
      operationIdRef.current = createOperationId('story');
    } catch (error) {
      logHandledError('story-pick-media', error);
      if (closeOnCancel) close();
    } finally {
      pickerBusyRef.current = false;
    }
  }, [close, t]);

  // Opening the composer is the same gesture as opening the gallery: there is
  // nothing to look at until a picture has been chosen.
  //
  // The ref makes it exactly once per opening. Watching the draft instead would
  // reopen the gallery on the way out, because publishing clears the draft
  // while the modal is still on screen.
  useEffect(() => {
    if (!visible) {
      launchedRef.current = false;
      reset();
      return;
    }
    if (launchedRef.current) return;
    launchedRef.current = true;
    if (initialMedia) {
      setMedia(initialMedia);
      return;
    }
    void pickMedia({ closeOnCancel: true });
  }, [initialMedia, pickMedia, reset, visible]);

  const commitOverlay = useCallback((next: StoryOverlay) => {
    setOverlays((current) => current.map((overlay) => (overlay.id === next.id ? next : overlay)));
  }, []);

  const deleteOverlay = useCallback((overlayId: string) => {
    setOverlays((current) => current.filter((overlay) => overlay.id !== overlayId));
  }, []);

  const handleDragState = useCallback((isDragging: boolean) => {
    setDragging(isDragging);
  }, []);

  // The bin's hit area and its drawing come from one measurement: the centre of
  // the circle as laid out. Fixed numbers used to describe a different spot
  // from the one on screen.
  const window = useWindowDimensions();
  const fingerX = useRef(new Animated.Value(FINGER_AT_REST)).current;
  const fingerY = useRef(new Animated.Value(FINGER_AT_REST)).current;
  const [measuredBin, setMeasuredBin] = useState<{ cx: number; cy: number } | null>(null);
  const bin = measuredBin ?? {
    cx: window.width / 2,
    cy: window.height - (Math.max(insets.bottom, 16) + 26) - TRASH_LABEL_ALLOWANCE - TRASH_SIZE / 2,
  };
  const binRef = useRef(bin);
  binRef.current = bin;
  const onTrashLayout = useCallback((event: LayoutChangeEvent) => {
    const { x, y, width } = event.nativeEvent.layout;
    const next = { cx: x + width / 2, cy: y + TRASH_SIZE / 2 };
    setMeasuredBin((current) =>
      current && Math.abs(current.cx - next.cx) < 1 && Math.abs(current.cy - next.cy) < 1 ? current : next,
    );
  }, []);
  // The finger, not the caption's centre, has to reach the bin: a long caption
  // held by one end would otherwise miss a bin the finger is right on.
  const isOverTrash = useCallback((absoluteX: number, absoluteY: number) => {
    const { cx, cy } = binRef.current;
    return Math.abs(absoluteX - cx) <= TRASH_HIT && absoluteY >= cy - TRASH_HIT;
  }, []);
  // 1 while the finger is over the bin, 0 elsewhere - the same rule as
  // isOverTrash, evaluated on the UI thread so the bin reacts at frame rate.
  const binActive = useMemo(() => Animated.multiply(
    fingerX.interpolate({
      inputRange: [bin.cx - TRASH_HIT - 1, bin.cx - TRASH_HIT, bin.cx + TRASH_HIT, bin.cx + TRASH_HIT + 1],
      outputRange: [0, 1, 1, 0],
      extrapolate: 'clamp',
    }),
    fingerY.interpolate({
      inputRange: [bin.cy - TRASH_HIT - 1, bin.cy - TRASH_HIT],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
  ), [bin.cx, bin.cy, fingerX, fingerY]);

  const addText = () => {
    const overlay = newTextOverlay();
    setOverlays((current) => [...current, overlay]);
    setEditingId(overlay.id);
  };

  const addLocation = (place: string) => {
    setLocationOpen(false);
    setOverlays((current) => [
      ...current,
      {
        ...newTextOverlay(),
        kind: 'location',
        text: place,
        y: 0.72,
        scale: 0.6,
      },
    ]);
  };

  const editing = overlays.find((overlay) => overlay.id === editingId) ?? null;

  const publish = async () => {
    if (!media || publishing) return;
    try {
      setPublishing(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');

      const signature = `${media.assetId || media.uri}:${media.fileSize || 0}`;
      let uploadedKey = uploadedRef.current?.signature === signature ? uploadedRef.current.key : undefined;
      if (!uploadedKey) {
        const controller = new AbortController();
        uploadAbortRef.current = controller;
        setUploadPercent(0);
        try {
          uploadedKey = await uploadMedia(media, 'stories', token, {
            signal: controller.signal,
            onProgress: ({ sentBytes, totalBytes }) => {
              if (totalBytes > 0) setUploadPercent(Math.min(100, Math.round((sentBytes / totalBytes) * 100)));
            },
          });
        } finally {
          uploadAbortRef.current = null;
          setUploadPercent(null);
        }
        uploadedRef.current = { signature, key: uploadedKey };
      }

      const mediaType: Story['media_type'] = media.type?.includes('video') ? 'video' : 'image';
      const data = await createStory(
        {
          operationId: operationIdRef.current,
          content: '',
          media_type: mediaType,
          background_color: '',
          overlays: overlays.filter((overlay) => overlay.text.trim().length > 0),
          uploadedKey,
        },
        token,
      );

      if (!data.success) {
        showError(t('common.error'), data.message || t('feed.story_create_failed'));
        return;
      }

      showSuccess(t('common.success'), t('feed.story_created'));
      reset();
      onSuccess?.();
      onClose();
    } catch (error) {
      // The member closed the composer mid-upload; that is not a failure.
      if (isUploadCancelled(error)) return;
      logHandledError('create-story', error);
      showError(t('common.error'), getUserFacingError(error, t('feed.story_create_failed')));
    } finally {
      setPublishing(false);
    }
  };

  // No early `return null` when hidden: unmounting the Modal skips its
  // dismissal animation and never fires onDismiss, which is what the share
  // sheet waits for before closing itself (see useAfterModalDismiss).
  const avatar = typeof user?.profile_picture === 'string' ? user.profile_picture.trim() : '';
  const isVideo = Boolean(media?.type?.includes('video'));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      hardwareAccelerated
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
      onDismiss={onDismiss}
    >
      <GestureHandlerRootView style={styles.root}>
        {/* The frame is the whole screen so the composed story and the story a
            viewer opens are the same picture, edge to edge, on every device. */}
        <View style={styles.frame} onLayout={onFrameLayout}>
          {media ? (
            isVideo ? (
              <StoryVideoPreview uri={media.uri} />
            ) : (
              // Contain, like the viewer: the draft has to show exactly what
              // will be posted, and a phone taller than 9:16 would otherwise
              // crop the edges off a share card's text.
              <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            )
          ) : (
            <View style={styles.pending}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          )}

          {overlays.map((overlay) => (
            <StoryDraggableOverlay
              key={overlay.id}
              overlay={overlay}
              frameWidth={frameWidth}
              frameHeight={frameHeight}
              onDragStateChange={handleDragState}
              fingerX={fingerX}
              fingerY={fingerY}
              isOverTrash={isOverTrash}
              onCommit={commitOverlay}
              onDelete={deleteOverlay}
              onEdit={setEditingId}
            />
          ))}
        </View>

        {/* Tool rail */}
        {media && !editing && !locationOpen && (
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <Pressable
              onPress={close}
              hitSlop={12}
              style={styles.roundButton}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Kapat')}
            >
              <Ionicons name="close" size={25} color="#FFFFFF" />
            </Pressable>

            <View style={styles.spacer} />

            <View style={styles.toolRail}>
              <Pressable
                onPress={addText}
                style={styles.roundButton}
                accessibilityRole="button"
                accessibilityLabel={t('story.add_text', 'Metin ekle')}
              >
                <Text style={styles.aaLabel}>Aa</Text>
              </Pressable>
              <Pressable
                onPress={() => setLocationOpen(true)}
                style={styles.roundButton}
                accessibilityRole="button"
                accessibilityLabel={t('story.add_location', 'Konum ekle')}
              >
                <Ionicons name="location-outline" size={22} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() => void pickMedia({ closeOnCancel: false })}
                style={styles.roundButton}
                accessibilityRole="button"
                accessibilityLabel={t('story.change_media', 'Fotografi degistir')}
              >
                <Ionicons name="images-outline" size={21} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Drop target: the caption being dragged is deleted when released
            here. Always laid out (just invisible) so it is measured before the
            first drag. */}
        <View
          style={[styles.trashZone, { bottom: Math.max(insets.bottom, 16) + 26, opacity: dragging ? 1 : 0 }]}
          pointerEvents="none"
          onLayout={onTrashLayout}
          accessibilityElementsHidden={!dragging}
          importantForAccessibility={dragging ? 'auto' : 'no-hide-descendants'}
        >
          <Animated.View
            style={[
              styles.trashCircle,
              { transform: [{ scale: binActive.interpolate({ inputRange: [0, 1], outputRange: [1, 1.24] }) }] },
            ]}
          >
            <Animated.View style={[styles.trashCircleActive, { opacity: binActive }]} />
            <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          </Animated.View>
          <Text style={styles.trashLabel}>
            {t('story.drag_to_delete', 'Silmek icin surukle')}
          </Text>
        </View>

        {/* Share row */}
        {media && !editing && !locationOpen && !dragging && (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
            <View style={styles.sharePill}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.shareAvatar} />
              ) : (
                <View style={[styles.shareAvatar, styles.shareAvatarFallback]}>
                  <Text style={styles.shareAvatarLetter}>
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <Text style={styles.sharePillLabel} numberOfLines={1}>
                {t('feed.your_story', 'Hikayem')}
              </Text>
            </View>

            <Pressable
              onPress={publish}
              disabled={publishing}
              style={[styles.sendButton, publishing && styles.sendButtonBusy]}
              accessibilityRole="button"
              accessibilityLabel={t('feed.post_action', 'Paylas')}
            >
              {publishing && uploadPercent !== null && uploadPercent > 0 ? (
                <Text style={styles.sendProgress}>{`${uploadPercent}%`}</Text>
              ) : publishing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="arrow-forward" size={23} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        )}

        {editing && (
          <StoryTextEditor
            key={editing.id}
            overlay={editing}
            onCancel={() => {
              // A caption that was never typed into should not linger as an
              // invisible, undeletable hit target.
              if (!editing.text.trim()) deleteOverlay(editing.id);
              setEditingId(null);
            }}
            onDone={(next) => {
              commitOverlay(next);
              setEditingId(null);
            }}
            onDelete={() => {
              deleteOverlay(editing.id);
              setEditingId(null);
            }}
          />
        )}

        {locationOpen && (
          <StoryLocationSheet onCancel={() => setLocationOpen(false)} onPick={addLocation} />
        )}
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  frame: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  pending: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    zIndex: 30,
  },
  spacer: { flex: 1 },
  toolRail: {
    gap: 12,
    alignItems: 'center',
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,26,0.55)',
  },
  aaLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  trashZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
    zIndex: 40,
  },
  trashCircle: {
    width: TRASH_SIZE,
    height: TRASH_SIZE,
    borderRadius: TRASH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,26,0.62)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  trashCircleActive: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(217,66,73,0.95)',
  },
  trashLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    zIndex: 30,
  },
  sharePill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 50,
    paddingHorizontal: 8,
    borderRadius: 25,
    backgroundColor: 'rgba(20,20,26,0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  shareAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  shareAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#312E81',
  },
  shareAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sharePillLabel: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7A4DF5',
  },
  sendButtonBusy: {
    opacity: 0.7,
  },
  sendProgress: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});

export default StoryComposer;
