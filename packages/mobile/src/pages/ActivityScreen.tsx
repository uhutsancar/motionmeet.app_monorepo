import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StatusBar, StyleSheet, View, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Avatar, Button, Surface, Text, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { Notification, Post, Story } from '@motionmeet/shared';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
  respondToFollowRequest,
} from '../features/notifications/notificationsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getPost, getStories } from '../api/endpoints';
import PostViewerModal from '../components/PostViewerModal';
import ScreenHeader from '../components/ScreenHeader';
import StoryViewer from '../components/StoryViewer';
import { AVATAR } from '../config/layout';
import dayjs, { setDayjsLocale } from '../utils/dayjs';
import { logHandledError, showInfo } from '../utils/feedback';
import type { NavigationOnlyProps } from '../navigation/types';

const ICONS: Record<Notification['type'], { name: keyof typeof Ionicons.glyphMap; tone: 'primary' | 'like' | 'muted' }> = {
  follow_request: { name: 'person-add', tone: 'primary' },
  follow_request_accepted: { name: 'checkmark-circle', tone: 'primary' },
  follow: { name: 'person', tone: 'primary' },
  post_like: { name: 'heart', tone: 'like' },
  post_comment: { name: 'chatbubble', tone: 'muted' },
  story_like: { name: 'heart', tone: 'like' },
};

/**
 * The real activity list behind the bell. Notification *preferences* stayed on
 * their own screen under Settings; this one shows what actually happened.
 */
const ActivityScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const { items, nextCursor, loading, loadingMore, respondingTo } = useAppSelector((state) => state.notifications);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [openStories, setOpenStories] = useState<Story[] | null>(null);
  const [openStoryIndex, setOpenStoryIndex] = useState(0);
  /** The row whose target is being fetched, so only that row shows a spinner. */
  const [openingId, setOpeningId] = useState<string | null>(null);

  setDayjsLocale(i18n.language);

  const load = useCallback(async (cursor?: string | null) => {
    try {
      const token = await getToken();
      if (!token) return;
      await dispatch(fetchNotifications({ token, cursor })).unwrap();
    } catch (error) {
      logHandledError('load-activity', error);
    }
  }, [dispatch, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Opening the screen is what counts as reading, so the badge clears here
  // rather than needing a separate gesture.
  useEffect(() => {
    let active = true;
    void (async () => {
      const token = await getToken();
      if (active && token) dispatch(markAllNotificationsRead(token));
    })();
    return () => { active = false; };
  }, [dispatch, getToken]);

  const respond = useCallback(async (requesterId: string, accept: boolean) => {
    try {
      const token = await getToken();
      if (!token) return;
      await dispatch(respondToFollowRequest({ requesterId, token, accept })).unwrap();
    } catch (error) {
      logHandledError('respond-follow-request', error);
    }
  }, [dispatch, getToken]);

  /**
   * Opens whatever the row is actually about.
   *
   * A notification that only ever led to the actor's profile is a dead end:
   * "someone liked your photo" should open the photo, and "someone liked your
   * story" should open the story. Anything whose target has since been deleted
   * — or a story that has expired, which is the normal case a day later — says
   * so plainly instead of opening the wrong screen.
   */
  const openNotification = useCallback(async (notification: Notification) => {
    const actorId = notification.actor?._id;
    const goToActor = () => {
      if (actorId) navigation.navigate('Profile', { userId: actorId });
    };

    if (notification.type === 'post_like' || notification.type === 'post_comment') {
      if (!notification.postId) return goToActor();
      setOpeningId(notification.id);
      try {
        const token = await getToken();
        if (!token) return;
        const result = await getPost(notification.postId, token);
        if (result.success && result.post) setOpenPost(result.post);
        else showInfo(t('activity.title', 'Bildirimler'), t('activity.post_gone', 'Bu gönderi artık mevcut değil.'));
      } catch (error) {
        logHandledError('open-notification-post', error);
        showInfo(t('activity.title', 'Bildirimler'), t('activity.post_gone', 'Bu gönderi artık mevcut değil.'));
      } finally {
        setOpeningId(null);
      }
      return;
    }

    if (notification.type === 'story_like') {
      if (!notification.storyId) return goToActor();
      setOpeningId(notification.id);
      try {
        const token = await getToken();
        if (!token) return;
        const result = await getStories(token);
        const mine = (result.stories || []).filter((story) => story._id === notification.storyId);
        // A story lives for a day, so a like from yesterday routinely points at
        // something that is no longer there.
        if (!mine.length) {
          showInfo(t('activity.title', 'Bildirimler'), t('activity.story_gone', 'Bu hikayenin süresi dolmuş.'));
          return;
        }
        setOpenStories(mine);
        setOpenStoryIndex(0);
      } catch (error) {
        logHandledError('open-notification-story', error);
        showInfo(t('activity.title', 'Bildirimler'), t('activity.story_gone', 'Bu hikayenin süresi dolmuş.'));
      } finally {
        setOpeningId(null);
      }
      return;
    }

    goToActor();
  }, [getToken, navigation, t]);

  const describe = (notification: Notification): string => {
    const name = notification.actor?.full_name || notification.actor?.username || t('activity.someone', 'Bir sporcu');
    switch (notification.type) {
      case 'follow_request':
        return t('activity.follow_request', '{{name}} seni takip etmek istiyor', { name });
      case 'follow_request_accepted':
        return t('activity.follow_request_accepted', '{{name}} takip isteğini kabul etti', { name });
      case 'follow':
        return t('activity.follow', '{{name}} seni takip etmeye başladı', { name });
      case 'post_like':
        return t('activity.post_like', '{{name}} gönderini beğendi', { name });
      case 'post_comment':
        return t('activity.post_comment', '{{name}} gönderine yorum yaptı', { name });
      case 'story_like':
        return t('activity.story_like', '{{name}} hikayeni beğendi', { name });
      default:
        return name;
    }
  };

  const renderItem: ListRenderItem<Notification> = ({ item }) => {
    const icon = ICONS[item.type] ?? ICONS.follow;
    const iconColor = icon.tone === 'like' ? theme.danger : icon.tone === 'muted' ? theme.textMuted : theme.primary;
    const actorId = item.actor?._id;
    const busy = actorId ? respondingTo.includes(actorId) : false;
    return (
      <TouchableRipple
        onPress={() => { void openNotification(item); }}
        style={[styles.row, !item.read && styles.rowUnread]}
      >
        <View style={styles.rowInner}>
          {item.actor?.profile_picture ? (
            <Avatar.Image size={AVATAR.row} source={{ uri: item.actor.profile_picture }} />
          ) : (
            <Avatar.Text
              size={AVATAR.row}
              label={(item.actor?.full_name || '?').charAt(0).toUpperCase()}
              style={{ backgroundColor: theme.primarySoft }}
              labelStyle={{ color: theme.primary }}
            />
          )}
          <View style={styles.rowBody}>
            <Text style={styles.rowText}>{describe(item)}</Text>
            <Text style={styles.rowTime}>{dayjs(item.createdAt).fromNow()}</Text>
            {item.actionable && actorId ? (
              <View style={styles.actions}>
                <Button
                  mode="contained"
                  compact
                  loading={busy}
                  disabled={busy}
                  onPress={() => { void respond(actorId, true); }}
                  style={styles.confirmButton}
                  labelStyle={styles.actionLabel}
                >
                  {t('activity.confirm', 'Onayla')}
                </Button>
                <Button
                  mode="outlined"
                  compact
                  disabled={busy}
                  onPress={() => { void respond(actorId, false); }}
                  textColor={theme.textMuted}
                  style={styles.declineButton}
                  labelStyle={styles.actionLabel}
                >
                  {t('activity.decline', 'Sil')}
                </Button>
              </View>
            ) : null}
          </View>
          {openingId === item.id ? (
            <ActivityIndicator size={16} color={theme.primary} style={styles.rowIcon} />
          ) : (
            <Ionicons name={icon.name} size={18} color={iconColor} style={styles.rowIcon} />
          )}
        </View>
      </TouchableRipple>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader
        title={t('activity.title', 'Bildirimler')}
        onBack={() => navigation.goBack()}
        actions={[
          {
            icon: 'settings-outline',
            onPress: () => navigation.navigate('NotificationsScreen'),
            accessibilityLabel: t('settings.notifications', 'Bildirim ayarları'),
            tint: theme.textMuted,
          },
        ]}
      />

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} tintColor={theme.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (nextCursor && !loadingMore && !loading) void load(nextCursor); }}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={theme.primary} /> : null}
        ListEmptyComponent={
          loading ? null : (
            <Surface elevation={0} style={styles.empty}>
              <Ionicons name="notifications-outline" size={30} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>{t('activity.empty_title', 'Henüz bildirim yok')}</Text>
              <Text style={styles.emptyBody}>
                {t('activity.empty_body', 'Takip istekleri ve beğeniler burada görünecek.')}
              </Text>
            </Surface>
          )
        }
      />

      {/* One post, from the notification that pointed at it: there is no list
          behind an activity row to keep scrolling into. */}
      <PostViewerModal
        posts={openPost ? [openPost] : null}
        navigation={navigation}
        onClose={() => setOpenPost(null)}
      />

      {openStories ? (
        <StoryViewer
          visible
          stories={openStories}
          startIndex={openStoryIndex}
          navigation={navigation}
          onClose={() => setOpenStories(null)}
        />
      ) : null}
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  listContent: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 32 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  rowUnread: { backgroundColor: theme.surface },
  rowInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowBody: { flex: 1, minWidth: 0 },
  rowText: { color: theme.text, fontSize: 14, lineHeight: 20 },
  rowTime: { color: theme.textMuted, fontSize: 11.5, marginTop: 3 },
  rowIcon: { marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  confirmButton: { borderRadius: 8 },
  declineButton: { borderRadius: 8, borderColor: theme.border },
  actionLabel: { fontSize: 12, fontWeight: '700' },
  footer: { paddingVertical: 18 },
  empty: {
    marginHorizontal: 16, marginTop: 48, padding: 28, alignItems: 'center', borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.surface,
  },
  emptyTitle: { color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 10 },
  emptyBody: { color: theme.textMuted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});

export default ActivityScreen;
