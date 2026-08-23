import React, { useCallback, useEffect } from 'react';
import { FlatList, RefreshControl, StatusBar, StyleSheet, View, type ListRenderItem } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Appbar, Avatar, Button, Surface, Text, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { Notification } from '@motionmeet/shared';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
  respondToFollowRequest,
} from '../features/notifications/notificationsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { AVATAR } from '../config/layout';
import dayjs, { setDayjsLocale } from '../utils/dayjs';
import { logHandledError } from '../utils/feedback';
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
        onPress={() => { if (actorId) navigation.navigate('Profile', { userId: actorId }); }}
        style={[styles.row, !item.read && styles.rowUnread]}
      >
        <View style={styles.rowInner}>
          {item.actor?.profile_picture ? (
            <Avatar.Image size={AVATAR.medium} source={{ uri: item.actor.profile_picture }} />
          ) : (
            <Avatar.Text
              size={AVATAR.medium}
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
          <Ionicons name={icon.name} size={18} color={iconColor} style={styles.rowIcon} />
        </View>
      </TouchableRipple>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Appbar.Header style={styles.header} statusBarHeight={0}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('activity.title', 'Bildirimler')} titleStyle={styles.headerTitle} />
        <Appbar.Action
          icon="cog-outline"
          color={theme.textMuted}
          onPress={() => navigation.navigate('NotificationsScreen')}
          accessibilityLabel={t('settings.notifications', 'Bildirim ayarları')}
        />
      </Appbar.Header>

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
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border, elevation: 0 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
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
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
  },
  emptyTitle: { color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 10 },
  emptyBody: { color: theme.textMuted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});

export default ActivityScreen;
