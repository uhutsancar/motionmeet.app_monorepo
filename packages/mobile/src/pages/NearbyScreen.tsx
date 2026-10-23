import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, ActivityIndicator, FlatList, RefreshControl, StatusBar, View } from 'react-native';
// expo-image: these rows scroll past many remote avatars, and it recycles
// views and keeps a memory + disk cache where React Native's Image does not.
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Divider, Surface, Switch, Text, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { NEARBY_SCOPES, mediaVariantUrl, type NearbyScope, type NearbySettings, type NearbyUser } from '@motionmeet/shared';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { BAND_LABELS, SCOPE_LABELS } from '../config/nearbyLabels';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useDeviceLocation, type LocationOutcome } from '../hooks/useDeviceLocation';
import {
  getNearbySettings,
  getNearbyUsers,
  updateNearbyPosition,
  updateNearbySettings,
} from '../api/endpoints';
import { getUserFacingError, showError } from '../utils/feedback';
import ScreenHeader from '../components/ScreenHeader';
import type { NavigationOnlyProps } from '../navigation/types';

/**
 * Nearby athletes.
 *
 * The screen never sees a coordinate come back. It sends one fix when the
 * member opens it or pulls to refresh, and renders whatever distance band the
 * backend decided each person is willing to expose.
 *
 * Every permission outcome the OS can produce has its own copy and its own
 * recovery action, because "denied", "blocked in Settings" and "location
 * services are off device-wide" need three different things from the member.
 */

/** A fix this fresh is not worth asking the GPS for again. */
const FIX_REUSE_MS = 15 * 60 * 1000;

const NearbyScreen = ({ navigation }: NavigationOnlyProps) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const { horizontalPadding } = useResponsiveLayout();
  const { busy: locating, requestFix, checkPermission, openSettings } = useDeviceLocation();

  const [settings, setSettings] = useState<NearbySettings | null>(null);
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permission, setPermission] = useState<LocationOutcome | null>(null);
  const [toggling, setToggling] = useState(false);
  // Prevents the focus effect and a pull-to-refresh from racing each other.
  const loadingRef = useRef(false);

  const enabled = settings?.enabled ?? false;

  const loadList = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const response = await getNearbyUsers(token, 30);
    if (!response.success) throw new Error(response.message);
    setSettings(response.settings);
    setUsers(response.users ?? []);
    setReason(response.reason);
  }, [getToken]);

  /**
   * Sends a fix only when the stored one is missing or old. Opening the screen
   * repeatedly must not turn into a stream of position updates.
   */
  const refreshPosition = useCallback(async (current: NearbySettings | null, { force = false } = {}): Promise<boolean> => {
    const age = current?.locationUpdatedAt ? Date.now() - new Date(current.locationUpdatedAt).getTime() : Number.POSITIVE_INFINITY;
    if (!force && age < FIX_REUSE_MS) return true;

    const result = await requestFix();
    setPermission(result.outcome);
    if (result.outcome !== 'granted' || !result.fix) return false;

    const token = await getToken();
    if (!token) return false;
    const response = await updateNearbyPosition({
      latitude: result.fix.latitude,
      longitude: result.fix.longitude,
      accuracy: result.fix.accuracy,
      source: result.fix.source,
      permissionStatus: 'granted',
    }, token);
    if (response.success) setSettings(response.settings);
    return response.success;
  }, [getToken, requestFix]);

  const load = useCallback(async ({ force = false } = {}) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const token = await getToken();
      if (!token) return;
      const current = await getNearbySettings(token);
      if (current.success) setSettings(current.settings);
      setPermission(await checkPermission());

      if (current.settings?.enabled) {
        await refreshPosition(current.settings, { force });
        await loadList();
      } else {
        setUsers([]);
        setReason('disabled');
      }
    } catch (error) {
      showError(t('common.error', 'Error'), getUserFacingError(error, t('nearby.load_failed', 'Nearby athletes could not be loaded.')));
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [checkPermission, getToken, loadList, refreshPosition, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const explainOutcome = useCallback((outcome: LocationOutcome) => {
    const messages: Partial<Record<LocationOutcome, string>> = {
      denied: t('nearby.denied_body', 'Nearby needs your location while the screen is open. You can allow it any time.'),
      blocked: t('nearby.blocked_body', 'Location is turned off for MotionMeet. Open Settings to allow it.'),
      services_off: t('nearby.services_off_body', 'Location services are switched off on this device.'),
      unavailable: t('nearby.unavailable_body', 'Your position could not be read. Please try again in a moment.'),
      timeout: t('nearby.timeout_body', 'Reading your position took too long. Please try again.'),
    };
    showError(t('nearby.location_needed', 'Location needed'), messages[outcome] ?? messages.unavailable!);
  }, [t]);

  /**
   * Turning the feature on is the moment the OS prompt is justified, so the
   * permission request and the first fix happen here. If the member declines,
   * the switch goes straight back off rather than leaving the account marked
   * as opted in with nothing behind it.
   */
  const toggleFeature = useCallback(async (next: boolean) => {
    if (toggling) return;
    setToggling(true);
    try {
      const token = await getToken();
      if (!token) return;

      if (!next) {
        const response = await updateNearbySettings({ enabled: false }, token);
        if (response.success) setSettings(response.settings);
        setUsers([]);
        setReason('disabled');
        return;
      }

      const result = await requestFix();
      setPermission(result.outcome);
      if (result.outcome !== 'granted' || !result.fix) {
        explainOutcome(result.outcome);
        return;
      }

      const position = await updateNearbyPosition({
        latitude: result.fix.latitude,
        longitude: result.fix.longitude,
        accuracy: result.fix.accuracy,
        source: result.fix.source,
        permissionStatus: 'granted',
      }, token);
      if (position.success) setSettings(position.settings);
      await loadList();
    } catch (error) {
      showError(t('common.error', 'Error'), getUserFacingError(error));
    } finally {
      setToggling(false);
    }
  }, [explainOutcome, getToken, loadList, requestFix, t, toggling]);

  const changeScope = useCallback(async (scope: NearbyScope) => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await updateNearbySettings({ scope }, token);
      if (response.success) setSettings(response.settings);
      await loadList();
    } catch (error) {
      showError(t('common.error', 'Error'), getUserFacingError(error));
    }
  }, [getToken, loadList, t]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ force: true });
  }, [load]);

  const lastUpdatedLabel = useMemo(() => {
    if (!settings?.locationUpdatedAt) return null;
    const minutes = Math.round((Date.now() - new Date(settings.locationUpdatedAt).getTime()) / 60_000);
    if (minutes < 1) return t('nearby.updated_now', 'Updated just now');
    if (minutes < 60) return t('nearby.updated_minutes', 'Updated {{count}} min ago', { count: minutes });
    const hours = Math.round(minutes / 60);
    return t('nearby.updated_hours', 'Updated {{count}} h ago', { count: hours });
  }, [settings?.locationUpdatedAt, t]);

  const renderUser = useCallback(({ item }: { item: NearbyUser }) => (
    <TouchableRipple onPress={() => navigation.navigate('Profile', { userId: item._id })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
        {item.profile_picture ? (
          <Image source={{ uri: mediaVariantUrl(item.profile_picture, 'avatar') }} style={{ width: 46, height: 46, borderRadius: 23 }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item._id} />
        ) : (
          <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceLight }}>
            <Text style={{ color: theme.textSecondary, fontSize: 17, fontWeight: '500' }}>
              {item.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{item.full_name}</Text>
          <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 1 }}>@{item.username}</Text>
          {item.approximateArea ? (
            <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: 11, marginTop: 3 }}>
              <Ionicons name="location-outline" size={10} /> {item.approximateArea}
            </Text>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: theme.surfaceLight }}>
          <Text style={{ color: theme.textSecondary, fontSize: 10.5, fontWeight: '700' }}>
            {t(BAND_LABELS[item.distanceBand].key, BAND_LABELS[item.distanceBand].fallback)}
          </Text>
        </View>
      </View>
    </TouchableRipple>
  ), [navigation, t, theme]);

  const permissionNotice = () => {
    if (!enabled || permission === 'granted' || permission === null) return null;
    const notices: Partial<Record<LocationOutcome, { title: string; body: string; action: string | null }>> = {
      denied: {
        title: t('nearby.denied_title', 'Location permission is off'),
        body: t('nearby.denied_body', 'Nearby needs your location while the screen is open. You can allow it any time.'),
        action: t('nearby.allow', 'Allow'),
      },
      blocked: {
        title: t('nearby.blocked_title', 'Allow location in Settings'),
        body: t('nearby.blocked_body', 'Location is turned off for MotionMeet. Open Settings to allow it.'),
        action: t('nearby.open_settings', 'Open Settings'),
      },
      services_off: {
        title: t('nearby.services_off_title', 'Location services are off'),
        body: t('nearby.services_off_body', 'Location services are switched off on this device.'),
        action: t('nearby.open_settings', 'Open Settings'),
      },
      unavailable: {
        title: t('nearby.unavailable_title', 'No position yet'),
        body: t('nearby.unavailable_body', 'Your position could not be read. Please try again in a moment.'),
        action: t('nearby.retry', 'Try again'),
      },
      timeout: {
        title: t('nearby.timeout_title', 'Taking too long'),
        body: t('nearby.timeout_body', 'Reading your position took too long. Please try again.'),
        action: t('nearby.retry', 'Try again'),
      },
    };
    const notice = notices[permission];
    if (!notice) return null;

    return (
      <Surface elevation={0} style={{ padding: 14, borderRadius: 12, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: `${theme.warning}55`, backgroundColor: `${theme.warning}14` }}>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>{notice.title}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>{notice.body}</Text>
        {notice.action ? (
          <TouchableRipple
            onPress={() => void (permission === 'blocked' || permission === 'services_off' ? openSettings() : load({ force: true }))}
            style={{ alignSelf: 'flex-start', paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: 9, backgroundColor: theme.primary }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>{notice.action}</Text>
          </TouchableRipple>
        ) : null}
      </Surface>
    );
  };

  const emptyState = () => {
    if (loading || locating) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
          <ActivityIndicator color={theme.primary} />
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>{t('nearby.loading', 'Looking around you…')}</Text>
        </View>
      );
    }
    const copy = {
      disabled: {
        title: t('nearby.off_title', 'Nearby is off'),
        body: t('nearby.off_body', 'Turn it on to see athletes training close to you.'),
      },
      no_fix: {
        title: t('nearby.no_fix_title', 'No position yet'),
        body: t('nearby.no_fix_body', 'Pull down to read your position and load the list.'),
      },
      stale_fix: {
        title: t('nearby.stale_title', 'Your position is out of date'),
        body: t('nearby.stale_body', 'Pull down to refresh it.'),
      },
      no_results: {
        title: t('nearby.empty_title', 'Nobody here yet'),
        body: t('nearby.empty_body', 'Try a wider radius — MotionMeet is still growing in your area.'),
      },
    }[reason ?? 'no_results'] ?? {
      title: t('nearby.empty_title', 'Nobody here yet'),
      body: t('nearby.empty_body', 'Try a wider radius — MotionMeet is still growing in your area.'),
    };

    return (
      <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 26, gap: 7 }}>
        <Ionicons name="compass-outline" size={30} color={theme.textMuted} />
        <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '700' }}>{copy.title}</Text>
        <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 17 }}>{copy.body}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader
        title={t('nearby.title', 'Nearby')}
        onBack={() => navigation.goBack()}
        actions={[
          {
            icon: 'settings-outline',
            onPress: () => navigation.navigate('LocationSettingsScreen'),
            accessibilityLabel: t('location.settings_title', 'Konum ayarları'),
          },
        ]}
      />

      <FlatList
        data={enabled ? users : []}
        keyExtractor={(item) => item._id}
        renderItem={renderUser}
        ItemSeparatorComponent={() => <Divider />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
        contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: horizontalPadding, paddingBottom: 28 }}
        ListHeaderComponent={(
          <View style={{ gap: 12, paddingTop: 12, paddingBottom: 14 }}>
            <Surface elevation={0} style={{ padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.surface, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: '700' }}>
                    {t('nearby.feature_title', 'Show athletes near me')}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 3, lineHeight: 16 }}>
                    {t('nearby.feature_body', 'Your exact position is never shown to anyone and is only read while this screen is open.')}
                  </Text>
                </View>
                <Switch value={enabled} onValueChange={(next) => void toggleFeature(next)} disabled={toggling || locating} color={theme.primary} />
              </View>

              {enabled && settings?.approximateArea ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="navigate-circle-outline" size={14} color={theme.secondary} />
                  <Text style={{ color: theme.textSecondary, fontSize: 11.5, flex: 1 }} numberOfLines={1}>
                    {settings.approximateArea}
                    {lastUpdatedLabel ? ` · ${lastUpdatedLabel}` : ''}
                  </Text>
                </View>
              ) : null}
            </Surface>

            {permissionNotice()}

            {enabled ? (
              <View>
                <Text style={{ color: theme.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.1, marginLeft: 4, marginBottom: 8 }}>
                  {t('nearby.radius', 'RADIUS')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {NEARBY_SCOPES.map((scope) => {
                    const active = settings?.scope === scope;
                    return (
                      <TouchableRipple
                        key={scope}
                        onPress={() => void changeScope(scope)}
                        style={{
                          paddingHorizontal: 13, height: 34, justifyContent: 'center', borderRadius: 17,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: active ? theme.primary : theme.border,
                          backgroundColor: active ? theme.primarySoft : theme.surface,
                        }}
                      >
                        <Text style={{ color: active ? theme.primary : theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                          {t(SCOPE_LABELS[scope].key, SCOPE_LABELS[scope].fallback)}
                        </Text>
                      </TouchableRipple>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={emptyState}
        ListFooterComponent={(
          <Text style={{ color: theme.textMuted, fontSize: 10, textAlign: 'center', marginTop: 18, lineHeight: 15, paddingHorizontal: 12 }}>
            {t('nearby.privacy_note', 'Distances are shown as ranges, never as an exact figure. MotionMeet does not track you in the background and keeps no location history.')}
          </Text>
        )}
      />
    </SafeAreaView>
  );
};

export default NearbyScreen;
