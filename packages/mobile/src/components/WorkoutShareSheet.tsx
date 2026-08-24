import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  View,
  type ListRenderItem,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SvgXml } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_ROUTES,
  SHARE_CARD_SIZES,
  createOperationId,
  SHARE_CARD_TEMPLATES,
  buildShareCardSvg,
  buildShareCardText,
  type ShareCardData,
  type ShareCardTemplate,
} from '@motionmeet/shared';
import { createStory } from '../api/endpoints';
import { uploadMedia } from '../api/mediaUpload';
import { useAuthContext } from '../context/AuthProvider';
import { fetchStories } from '../features/stories/storiesSlice';
import { useAppDispatch } from '../store/hooks';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../config/environment';
import { getUserFacingError, logHandledError, showError, showSuccess } from '../utils/feedback';

interface WorkoutShareSheetProps {
  visible: boolean;
  /** Everything the card draws. Built by the caller from the saved workout. */
  data: ShareCardData | null;
  /** Needed to ask the server for a real file; without it only text is offered. */
  workoutId: string | null;
  /** A link to the post the workout was shared as, when there is one. */
  shareUrl?: string | null;
  onClose: () => void;
}

interface ShareAction {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void | Promise<void>;
  /** Drawn in the Instagram gradient rather than the neutral plate. */
  accent?: boolean;
}

/** Where a rendered card is written before it is handed to another app. */
const CARD_FILE = 'motionmeet-share-card.png';

/* Measured chrome, so the card can be fitted into whatever is left of the
   screen rather than assuming a size that overflows a short phone. */
const TITLE_BLOCK_HEIGHT = 56;
const DOTS_HEIGHT = 20;
const ACTION_ROW_HEIGHT = 104;
const DONE_ROW_HEIGHT = 62;

/**
 * What to do with a finished workout.
 *
 * The shape of this screen is the one every training app has converged on, and
 * for good reason: the card is the point, so it is what fills the screen, and
 * every way of getting it out of the app is one row of icons underneath. Swipe
 * to choose a layout, tap once to send it.
 *
 * The previews are drawn on the device from the shared renderer, so flicking
 * through five layouts costs nothing and works with no signal. Only the actions
 * that need a real file — saving it, or handing it to Instagram — go to the
 * server, which rasterises the identical card. Nothing here captures a view, so
 * it all runs in Expo Go with no native module of its own.
 */
const WorkoutShareSheet = ({ visible, data, workoutId, shareUrl, onClose }: WorkoutShareSheetProps) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuthContext();
  const dispatch = useAppDispatch();

  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  /**
   * Actions that have already been carried out, so the row can say so.
   *
   * Sharing is not a one-shot flow — someone may well post to Instagram and
   * then save a copy — so nothing is disabled. A tick just answers "did that
   * work?" without the member having to guess from a toast they may have
   * missed.
   */
  const [done, setDone] = useState<Record<string, boolean>>({});
  /** The file for a template, once fetched, so a second tap is instant. */
  const cacheRef = useRef<Map<ShareCardTemplate, string>>(new Map());

  const window = useWindowDimensions();
  const pageWidth = window.width;

  /*
   * The card is sized to what is actually left over, not to a fixed width.
   *
   * A 9:16 card at 340pt wide is 604pt tall, which is more than the space above
   * the actions on most phones — so the preview ran off the bottom of the
   * screen and cut the brand row off the card. Measuring the chrome first and
   * fitting the card into the remainder keeps the whole card visible on a small
   * phone and still fills a large one.
   */
  const chromeHeight =
    insets.top + 12 + TITLE_BLOCK_HEIGHT + DOTS_HEIGHT + ACTION_ROW_HEIGHT + DONE_ROW_HEIGHT +
    Math.max(insets.bottom, 14);
  const availableHeight = Math.max(window.height - chromeHeight, 220);
  const cardHeight = Math.min(
    availableHeight,
    Math.round(((window.width - 64) * SHARE_CARD_SIZES.story.height) / SHARE_CARD_SIZES.story.width),
  );
  const cardWidth = Math.round(
    (cardHeight * SHARE_CARD_SIZES.story.width) / SHARE_CARD_SIZES.story.height,
  );

  const previews = useMemo(
    () =>
      data
        ? SHARE_CARD_TEMPLATES.map((template) => ({
            template,
            svg: buildShareCardSvg(data, template, 'story'),
          }))
        : [],
    [data],
  );

  const template = previews[index]?.template ?? 'summary';

  /**
   * Downloads the chosen card as a PNG.
   *
   * The server renders it because rasterising on the phone would need a native
   * module Expo Go does not carry, and because a card built there is guaranteed
   * to be the one that was on screen — both sides draw the same SVG.
   */
  const fetchCardFile = useCallback(async (): Promise<string | null> => {
    if (!workoutId) return null;
    const cached = cacheRef.current.get(template);
    if (cached) return cached;

    const token = await getToken();
    if (!token) return null;

    const target = `${FileSystem.cacheDirectory}${template}-${CARD_FILE}`;
    const url = `${API_URL}${API_ROUTES.workout.shareCard(workoutId)}?template=${template}&size=story`;
    // downloadAsync takes the remote URL first and the destination second.
    const result = await FileSystem.downloadAsync(url, target, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Throwing rather than returning null: every caller needs the file, and a
    // silent null left them all showing the same unhelpful message.
    if (result.status !== 200) {
      throw new Error(`Share card request failed with ${result.status}`);
    }
    cacheRef.current.set(template, result.uri);
    return result.uri;
  }, [getToken, template, workoutId]);

  const run = useCallback(
    async (key: string, action: () => Promise<void>) => {
      if (busy) return;
      setBusy(key);
      try {
        await action();
        setDone((current) => ({ ...current, [key]: true }));
      } catch (error) {
        logHandledError(`workout-share-${key}`, error);
        // Say what actually went wrong. A single "sharing failed" for a network
        // timeout, a rejected upload and a missing permission tells the member
        // nothing about which of them they can do something about.
        showError(
          t('common.error', 'Hata'),
          getUserFacingError(error, t('workout.share_failed', 'Paylaşım tamamlanamadı.')),
        );
      } finally {
        setBusy(null);
      }
    },
    [busy, t],
  );

  /**
   * Writes the card to the camera roll, if that is possible at all here.
   *
   * Returns false rather than throwing when the platform will not allow it, so
   * the caller can fall back to the share sheet instead of showing an error for
   * something the member cannot fix.
   */
  const saveToGallery = useCallback(async (uri: string): Promise<boolean> => {
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) return false;
      await MediaLibrary.saveToLibraryAsync(uri);
      return true;
    } catch (error) {
      logHandledError('workout-share-save', error);
      return false;
    }
  }, []);

  const caption = data ? buildShareCardText(data, shareUrl ?? undefined) : '';

  const actions: ShareAction[] = [
    {
      key: 'stories',
      icon: 'logo-instagram',
      accent: true,
      label: t('workout.share_stories', 'Hikayeler'),
      onPress: () =>
        run('stories', async () => {
          const uri = await fetchCardFile();
          if (!uri) {
            showError(t('common.error', 'Hata'), t('workout.share_failed', 'Paylaşım tamamlanamadı.'));
            return;
          }
          // The OS sheet is what actually offers Instagram. Posting straight to
          // Stories needs a private API on iOS and a signed intent on Android,
          // neither of which stays working for long; handing the file to the
          // sheet reaches the same place and keeps working.
          if (!(await Sharing.isAvailableAsync())) {
            await Share.share({ message: caption });
            return;
          }
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: t('workout.share_stories', 'Hikayeler'),
            UTI: 'public.png',
          });
        }),
    },
    {
      key: 'story',
      icon: 'add-circle-outline',
      label: t('workout.share_story', 'MotionMeet hikayem'),
      onPress: () =>
        run('story', async () => {
          const uri = await fetchCardFile();
          const token = await getToken();
          if (!uri || !token) {
            showError(t('common.error', 'Hata'), t('workout.share_failed', 'Paylaşım tamamlanamadı.'));
            return;
          }
          // The card is already a finished 9:16 picture, so it goes up as the
          // story itself; there is nothing left to compose on top of it.
          const uploadedKey = await uploadMedia(
            { uri, mimeType: 'image/png', fileName: `${template}.png` },
            'stories',
            token,
          );
          const result = await createStory(
            {
              operationId: createOperationId('story'),
              content: '',
              media_type: 'image',
              background_color: '',
              overlays: [],
              uploadedKey,
            },
            token,
          );
          if (!result.success) {
            throw new Error(result.message || 'Story could not be created');
          }
          // Pull the rail so the new story is on it straight away. Without this
          // the card was posted and nothing on screen changed, which reads
          // exactly like the button having done nothing at all.
          const refreshToken = await getToken();
          if (refreshToken) await dispatch(fetchStories(refreshToken)).unwrap().catch(() => undefined);
          showSuccess(t('common.success', 'Başarılı'), t('feed.story_created', 'Hikayen paylaşıldı'));
          // The story is posted and the rail behind this sheet now shows it, so
          // the sheet has nothing left to do. Leaving it open looked like the
          // tap had been ignored, and the card got posted three times.
          onClose();
        }),
    },
    {
      key: 'more',
      icon: 'share-outline',
      label: t('workout.share_more', 'Daha fazla'),
      onPress: () =>
        run('more', async () => {
          const uri = await fetchCardFile();
          if (uri && (await Sharing.isAvailableAsync())) {
            await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
            return;
          }
          await Share.share({ message: caption });
        }),
    },
    {
      key: 'download',
      icon: 'download-outline',
      label: t('workout.share_download', 'İndir'),
      onPress: () =>
        run('download', async () => {
          const uri = await fetchCardFile();
          if (!uri) {
            showError(t('common.error', 'Hata'), t('workout.share_failed', 'Paylaşım tamamlanamadı.'));
            return;
          }

          /*
           * Writing straight to the camera roll is the good path, but it is not
           * always open. Expo Go no longer grants full media-library access on
           * Android — it says so on every launch — so `saveToLibraryAsync`
           * there fails no matter what the member taps. Handing the file to the
           * OS sheet reaches the same place through "Save to Photos" and works
           * in Expo Go, in a development build and in the store build alike,
           * which is why it is the fallback rather than an error message.
           */
          const saved = await saveToGallery(uri);
          if (saved) {
            showSuccess(t('common.success', 'Başarılı'), t('workout.share_saved', 'Galeriye kaydedildi'));
            return;
          }

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'image/png',
              dialogTitle: t('workout.share_download', 'İndir'),
              UTI: 'public.png',
            });
            return;
          }

          showError(
            t('common.error', 'Hata'),
            t('workout.share_save_denied', 'Kaydetmek için galeri izni gerekiyor.'),
          );
        }),
    },
    ...(shareUrl
      ? [
          {
            key: 'link',
            icon: 'link-outline' as const,
            label: t('workout.share_link', 'Antrenman bağlantısı'),
            onPress: () =>
              run('link', async () => {
                await Clipboard.setStringAsync(shareUrl);
                showSuccess(t('common.success', 'Başarılı'), t('feed.link_copied', 'Bağlantı kopyalandı'));
              }),
          },
        ]
      : []),
    {
      key: 'text',
      icon: 'copy-outline',
      label: t('workout.share_copy_text', 'Metni kopyala'),
      onPress: () =>
        run('text', async () => {
          await Clipboard.setStringAsync(caption);
          showSuccess(t('common.success', 'Başarılı'), t('workout.share_text_copied', 'Metin kopyalandı'));
        }),
    },
  ];

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setIndex(Math.max(0, Math.min(previews.length - 1, next)));
  };

  const renderPreview: ListRenderItem<{ template: ShareCardTemplate; svg: string }> = ({ item }) => (
    <View style={[styles.page, { width: pageWidth }]}>
      <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
        <SvgXml xml={item.svg} width="100%" height="100%" />
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible && Boolean(data)}
      animationType="slide"
      presentationStyle="fullScreen"
      hardwareAccelerated
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: theme.text }]}>{t('workout.share_title', 'Güzeldi!')}</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {t('workout.share_subtitle', 'Antrenmanını paylaş')}
        </Text>

        <FlatList
          data={previews}
          renderItem={renderPreview}
          keyExtractor={(item) => item.template}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={styles.carousel}
        />

        <View style={styles.dots}>
          {previews.map((preview, dot) => (
            <View
              key={preview.template}
              style={[
                styles.dot,
                { backgroundColor: dot === index ? theme.primary : theme.border },
              ]}
            />
          ))}
        </View>

        {/* A horizontal strip that says it is one: the last item is deliberately
            left peeking at the edge, so it reads as "there is more" instead of
            looking like a label that got cut off. */}
        <FlatList
          data={actions}
          keyExtractor={(action) => action.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.actionList}
          contentContainerStyle={styles.actionRow}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void item.onPress()}
              disabled={Boolean(busy)}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: item.accent ? theme.primarySoft : theme.surfaceLight },
                ]}
              >
                {busy === item.key ? (
                  <ActivityIndicator size={18} color={theme.primary} />
                ) : done[item.key] ? (
                  <Ionicons name="checkmark" size={21} color={theme.primary} />
                ) : (
                  <Ionicons
                    name={item.icon}
                    size={21}
                    color={item.accent ? theme.primary : theme.textSecondary}
                  />
                )}
              </View>
              <Text numberOfLines={2} style={[styles.actionLabel, { color: theme.textMuted }]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />

        <Pressable
          onPress={onClose}
          style={[styles.done, { backgroundColor: theme.primary, marginBottom: Math.max(insets.bottom, 14) }]}
          accessibilityRole="button"
          accessibilityLabel={t('story.done', 'Bitti')}
        >
          <Text style={styles.doneLabel}>{t('story.done', 'Bitti')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  carousel: {
    flexGrow: 0,
    marginTop: 16,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    // A share card is already a finished picture; the only thing the preview
    // adds is a corner radius so it reads as a card rather than as the screen.
    backgroundColor: '#0D1424',
  },
  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionList: {
    flexGrow: 0,
  },
  actionRow: {
    paddingHorizontal: 16,
    gap: 14,
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 4,
  },
  action: {
    width: 76,
    alignItems: 'center',
    gap: 7,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 10.5,
    lineHeight: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  done: {
    marginTop: 12,
    marginHorizontal: 16,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default WorkoutShareSheet;
