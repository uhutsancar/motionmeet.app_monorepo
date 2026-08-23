import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
// expo-image: these rows scroll past many remote avatars, and it recycles
// views and keeps a memory + disk cache where React Native's Image does not.
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Appbar, Button, Chip, Divider, Surface, Text, TouchableRipple } from 'react-native-paper';
import { useAuthContext } from "../context/AuthProvider";
import Ionicons from '@expo/vector-icons/Ionicons';
import { MESSAGE_ICON } from '../config/icons';
import { useTranslation } from 'react-i18next';
import { fetchConnections } from '../features/connections/connectionsSlice';
import {
  acceptConnectionRequest,
  acceptFollowRequest,
  declineFollowRequest,
  getIncomingFollowRequests,
  getUserConnections,
  unfollowUser,
} from '../api/endpoints';
import { useTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { AVATAR } from '../config/layout';
import { setRelationship } from '../features/relationships/relationshipsSlice';
import { getUserFacingError, showError } from '../utils/feedback';
import { useAppDispatch } from '../store/hooks';
import { mediaVariantUrl, type PublicUser } from '@motionmeet/shared';
import type { NavigationOnlyProps, RouteLike } from '../navigation/types';

type ConnectionTabKey = typeof TABS[number]['key'];
interface ConnectionsProps extends NavigationOnlyProps {
  route?: RouteLike<{ section?: string }>;
}
interface ConnectionPage { items: PublicUser[]; nextCursor: string | null; loaded: boolean; loading: boolean }
type ConnectionPages = Record<ConnectionTabKey, ConnectionPage>;

const TABS = [
  // `Requests` is the follow-request inbox; `Pending` is the older two-way
  // connection queue, which still exists alongside it.
  { key: 'Requests', section: 'followRequests', labelKey: 'connections.requests', fallback: 'Requests' },
  { key: 'Followers', section: 'followers', labelKey: 'profile.followers', fallback: 'Followers' },
  { key: 'Following', section: 'following', labelKey: 'profile.following', fallback: 'Following' },
  { key: 'Pending', section: 'pendingConnections', labelKey: 'connections.pending', fallback: 'Pending' },
  { key: 'Connections', section: 'connections', labelKey: 'connections.title', fallback: 'Connections' },
];

const createEmptyPages = (): ConnectionPages => Object.fromEntries(
  TABS.map(({ key }) => [
    key,
    { items: [], nextCursor: null, loaded: false, loading: false },
  ]),
) as ConnectionPages;

const Connections = ({ navigation, route }: ConnectionsProps) => {
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { horizontalPadding } = useResponsiveLayout();
  // Opened straight on the followers/following list when the profile counters
  // are tapped, otherwise on the first tab.
  const requestedSection = route?.params?.section;
  const [currentTab, setCurrentTab] = useState<ConnectionTabKey>(
    TABS.some((tab) => tab.key === requestedSection) ? (requestedSection as ConnectionTabKey) : TABS[0].key,
  );
  const [pages, setPages] = useState(createEmptyPages);
  const [actionLoading, setActionLoading] = useState(false);
  const inFlightSectionsRef = useRef<Set<string>>(new Set());

  const loadSection = useCallback(async (tabKey: ConnectionTabKey, { append = false }: { append?: boolean } = {}) => {
    const tab = TABS.find((item) => item.key === tabKey);
    if (!tab || inFlightSectionsRef.current.has(tab.section)) return;
    const currentPage = pages[tabKey];
    const cursor = append ? currentPage?.nextCursor : null;
    if (append && !cursor) return;

    inFlightSectionsRef.current.add(tab.section);
    setPages((current) => ({
      ...current,
      [tabKey]: { ...current[tabKey], loading: true },
    }));
    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      // Follow requests live on their own endpoint, which answers with
      // `{ user, createdAt }` rows rather than bare users.
      const data = tab.section === 'followRequests'
        ? await getIncomingFollowRequests(token, cursor).then((page) => ({
            success: page.success,
            message: page.message,
            items: (page.items || []).map((entry) => entry.user),
            nextCursor: page.nextCursor,
          }))
        : await getUserConnections(token, tab.section, cursor);
      if (!data.success) throw new Error(data.message || 'Connections could not be loaded');
      setPages((current) => {
        const previousItems = append ? current[tabKey].items : [];
        const knownIds = new Set(previousItems.map((user) => user?._id));
        const newItems = (data.items || []).filter((user) => user?._id && !knownIds.has(user._id));
        return {
          ...current,
          [tabKey]: {
            items: [...previousItems, ...newItems],
            nextCursor: data.nextCursor || null,
            loaded: true,
            loading: false,
          },
        };
      });
    } catch (error: unknown) {
      Alert.alert(t('common.error', 'Hata'), error instanceof Error ? error.message : 'Request failed');
      setPages((current) => ({
        ...current,
        [tabKey]: { ...current[tabKey], loaded: true, loading: false },
      }));
    } finally {
      inFlightSectionsRef.current.delete(tab.section);
    }
  }, [getToken, pages, t]);

  useEffect(() => {
    if (!pages[currentTab].loaded) void loadSection(currentTab);
  }, [currentTab, loadSection, pages]);

  const handleUnfollow = async (userId: string) => {
    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = await unfollowUser(userId, token);
      if (data.success) {
        await Promise.all([
          loadSection('Following'),
          dispatch(fetchConnections(token)),
        ]);
      } else {
        Alert.alert(t('common.error', 'Hata'), data.message);
      }
    } catch (error: unknown) {
      Alert.alert(t('common.error', 'Hata'), error instanceof Error ? error.message : 'Request failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptConnection = async (userId: string) => {
    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = await acceptConnectionRequest(userId, token);
      if (data.success) {
        await Promise.all([
          loadSection('Pending'),
          loadSection('Connections'),
          dispatch(fetchConnections(token)),
        ]);
      } else {
        Alert.alert(t('common.error', 'Hata'), data.message);
      }
    } catch (error: unknown) {
      Alert.alert(t('common.error', 'Hata'), error instanceof Error ? error.message : 'Request failed');
    } finally {
      setActionLoading(false);
    }
  };

  /** Approves or rejects an incoming follow request from the Requests tab. */
  const handleFollowRequest = async (userId: string, accept: boolean) => {
    try {
      setActionLoading(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const data = accept
        ? await acceptFollowRequest(userId, token)
        : await declineFollowRequest(userId, token);
      if (!data.success) throw new Error(data.message || 'Request failed');
      dispatch(setRelationship({ userId, relationship: data.relationship }));
      // The row leaves Requests either way; accepting also adds a follower.
      setPages((current) => ({
        ...current,
        Requests: { ...current.Requests, items: current.Requests.items.filter((user) => user._id !== userId) },
        Followers: { ...current.Followers, loaded: false },
      }));
    } catch (error: unknown) {
      showError(t('common.error', 'Hata'), getUserFacingError(error));
    } finally {
      setActionLoading(false);
    }
  };

  const currentPage = pages[currentTab];
  const currentData = currentPage.items;

  // One tappable row per person, full bleed, with the actions inline.
  const renderUser = ({ item: user }: { item: PublicUser }) => (
    <TouchableRipple
      onPress={() => navigation.navigate('Profile', { userId: user._id })}
      accessibilityRole="button"
      accessibilityLabel={user.full_name || user.username}
      style={{
        paddingHorizontal: horizontalPadding,
        paddingVertical: 8,
        backgroundColor: theme.background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {user.profile_picture ? (
          <Image
            source={{ uri: mediaVariantUrl(user.profile_picture, 'avatar') }}
            style={{ width: AVATAR.medium, height: AVATAR.medium, borderRadius: AVATAR.medium / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={user._id}
            accessibilityLabel={user.full_name}
          />
        ) : (
          <Surface
            elevation={0}
            style={{ width: AVATAR.medium, height: AVATAR.medium, borderRadius: AVATAR.medium / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primarySoft }}
          >
            <Text style={{ color: theme.primary, fontWeight: '900' }}>
              {(user.full_name || user.username || '?').charAt(0).toUpperCase()}
            </Text>
          </Surface>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            variant="titleSmall"
            numberOfLines={1}
            style={{ color: theme.text, fontWeight: '700' }}
          >
            {user.full_name}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.textMuted }}>
            @{user.username}
          </Text>
        </View>
        {/* Actions live on the same row as the person: a single icon for
            messaging keeps the row compact instead of a labelled button. */}
        {(currentTab === 'Following' || currentTab === 'Connections') && (
          <TouchableRipple
            onPress={() => navigation.navigate('ChatBox', { userId: user._id, user })}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.primarySoft,
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('common.message_action', 'Send message')}: ${user.username}`}
            borderless
          >
            <Ionicons name={MESSAGE_ICON} size={16} color={theme.primary} />
          </TouchableRipple>
        )}
        {currentTab === 'Requests' && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button
              mode="contained"
              compact
              onPress={() => handleFollowRequest(user._id, true)}
              disabled={actionLoading}
              style={{ borderRadius: 16 }}
              labelStyle={{ fontSize: 11, fontWeight: '700' }}
            >
              {t('activity.confirm', 'Onayla')}
            </Button>
            <Button
              mode="outlined"
              compact
              onPress={() => handleFollowRequest(user._id, false)}
              disabled={actionLoading}
              textColor={theme.textMuted}
              style={{ borderRadius: 16, borderColor: theme.border }}
              labelStyle={{ fontSize: 11, fontWeight: '700' }}
            >
              {t('activity.decline', 'Sil')}
            </Button>
          </View>
        )}
        {currentTab === 'Pending' && (
          <Button
            mode="contained"
            compact
            onPress={() => handleAcceptConnection(user._id)}
            disabled={actionLoading}
            style={{ borderRadius: 16 }}
            labelStyle={{ fontSize: 11, fontWeight: '700' }}
          >
            {t('connections.accept', 'Kabul et')}
          </Button>
        )}
        {currentTab === 'Following' && (
          <TouchableRipple
            onPress={() => handleUnfollow(user._id)}
            disabled={actionLoading}
            style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('connections.unfollow', 'Takibi bırak')}
            borderless
          >
            <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700' }}>
              {t('connections.unfollow', 'Takibi bırak')}
            </Text>
          </TouchableRipple>
        )}
      </View>
    </TouchableRipple>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.surface, elevation: 0 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content
          title={t('connections.title', 'Connections')}
          titleStyle={{ color: theme.text, fontWeight: '700' }}
        />
        {/* Finding people is what this screen is for, so proximity discovery
            belongs here rather than buried in settings. */}
        <Appbar.Action
          icon="map-marker-radius-outline"
          color={theme.text}
          accessibilityLabel={t('nearby.title', 'Nearby')}
          onPress={() => navigation.navigate('NearbyScreen')}
        />
      </Appbar.Header>

      {/* The counter cards that used to sit here are gone. Only the tab that
          has been opened knows its own count, so four of the five read "—" and
          the row showed up as an empty grey strip under the title. The chips
          below already say where you are. */}

      {/* Tab chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // The row must not stretch or shrink: without both flags the chips get
        // clipped at the bottom on short screens.
        style={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          flexGrow: 0,
          flexShrink: 0,
        }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: horizontalPadding,
          paddingVertical: 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingRight: horizontalPadding,
          }}
        >
          {TABS.map((tab) => (
            <Chip
              key={tab.key}
              selected={currentTab === tab.key}
              onPress={() => setCurrentTab(tab.key)}
              style={{ backgroundColor: currentTab === tab.key ? theme.primary : theme.surface }}
              textStyle={{ color: currentTab === tab.key ? '#fff' : theme.text, fontWeight: '600' }}
            >
              {t(tab.labelKey, tab.fallback)}
            </Chip>
          ))}
        </View>
      </ScrollView>

      <Divider />

      {currentPage.loading && currentData.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item._id}
          renderItem={renderUser}
          style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={currentPage.loading && currentData.length > 0}
              onRefresh={() => loadSection(currentTab)}
              tintColor={theme.primary}
            />
          }
          onEndReached={() => loadSection(currentTab, { append: true })}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            currentPage.loading && currentData.length > 0
              ? <ActivityIndicator style={{ paddingVertical: 18 }} color={theme.primary} />
              : null
          }
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 48, color: theme.textMuted }}>
              {t('connections.empty', 'Henüz kimse yok')}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default Connections;
