import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Localization from 'expo-localization';
import { useTranslation } from 'react-i18next';
import type { LocationSuggestion } from '@motionmeet/shared';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import {
  getRecentLocations,
  resolveCoordinates,
  saveProfileLocation,
  searchLocations,
} from '../api/endpoints';
import { fetchUser } from '../features/user/userSlice';
import { useAppDispatch } from '../store/hooks';
import { getUserFacingError, showError, showSuccess } from '../utils/feedback';
import ScreenHeader from '../components/ScreenHeader';
import SoftButton from '../components/ui/SoftButton';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { TYPE } from '../config/layout';
import type { NavigationScreenProps } from '../navigation/types';

/**
 * Picks a profile location from the reference dataset.
 *
 * There is no free-text path out of this screen on purpose: the member either
 * selects a suggestion the backend returned or leaves without changing
 * anything. Whatever ends up on the profile is a label the server rendered from
 * the record that was chosen.
 *
 * "Use my current location" is only a shortcut *into* the same list - the fix
 * is turned into a suggestion the member still has to confirm, and it never
 * enables the Nearby feature as a side effect.
 */

/** Long enough to swallow a burst of typing, short enough to feel immediate. */
const DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 2;

/**
 * The device region biases the ranking so a member in Turkey typing "nil" gets
 * Nilüfer before Nilphamari. It only reorders equally good text matches - no
 * result is ever hidden because of it - and it is read from the OS locale, not
 * from any location permission.
 */
const deviceRegion = (): string | null => {
  const region = Localization.getLocales()[0]?.regionCode;
  return typeof region === 'string' && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : null;
};

interface LocationPickerParams {
  /** Set when the picker was opened from the account-creation flow. */
  source?: 'manual_search' | 'onboarding' | 'profile_update';
}

const LocationPickerScreen = ({ navigation, route }: NavigationScreenProps<LocationPickerParams>) => {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const { getToken } = useAuthContext();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const { busy: locating, requestFix, openSettings } = useDeviceLocation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [recent, setRecent] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [proposal, setProposal] = useState<LocationSuggestion | null>(null);

  const locale = i18n.language.startsWith('tr') ? 'tr' : 'en';
  const country = useMemo(deviceRegion, []);
  const source = route.params?.source ?? 'manual_search';
  // Cancels the request a newer keystroke has already made irrelevant, so
  // out-of-order responses can never overwrite the visible list.
  const inFlight = useRef<AbortController | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await getRecentLocations(token, locale);
        if (active && response.success) setRecent(response.results ?? []);
      } catch {
        // Recent picks are a convenience; the search field works without them.
      }
    })();
    return () => { active = false; };
  }, [getToken, locale]);

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      inFlight.current?.abort();
      setResults([]);
      setSearching(false);
      setFailed(false);
      return;
    }

    setSearching(true);
    setFailed(false);
    const timer = setTimeout(() => {
      void (async () => {
        inFlight.current?.abort();
        const controller = new AbortController();
        inFlight.current = controller;
        try {
          const token = await getToken();
          if (!token) return;
          const response = await searchLocations(trimmed, token, { locale, country, limit: 15, signal: controller.signal });
          if (controller.signal.aborted) return;
          setResults(response.success ? response.results ?? [] : []);
        } catch {
          // An aborted request is a newer keystroke, not a failure.
          if (controller.signal.aborted) return;
          setResults([]);
          setFailed(true);
        } finally {
          if (!controller.signal.aborted) setSearching(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [country, getToken, locale, trimmed]);

  const select = useCallback(async (suggestion: LocationSuggestion) => {
    if (saving) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t('auth.session_expired', 'Your session has expired.'));
      // The id is what travels; the label on screen is only what the member saw.
      const payload = suggestion.kind === 'city'
        ? { cityId: suggestion.id }
        : suggestion.kind === 'state'
          ? { stateId: suggestion.id }
          : { countryId: suggestion.id };
      const response = await saveProfileLocation({ ...payload, source }, token, locale);
      if (!response.success) throw new Error(response.message);
      await dispatch(fetchUser(token));
      showSuccess(
        t('location.saved_title', 'Location updated'),
        response.location?.displayName || suggestion.displayName,
      );
      navigation.goBack();
    } catch (error) {
      showError(t('common.error', 'Error'), getUserFacingError(error, t('location.save_failed', 'The location could not be saved.')));
    } finally {
      setSaving(false);
    }
  }, [dispatch, getToken, locale, navigation, saving, source, t]);

  /**
   * Reads the device fix and offers the nearest settlement. Nothing is written
   * until the member taps the proposal, and the Nearby feature stays untouched.
   */
  const detectCurrentLocation = useCallback(async () => {
    const result = await requestFix();
    if (result.outcome !== 'granted' || !result.fix) {
      const messages: Record<string, string> = {
        denied: t('location.permission_denied', 'Location permission is needed to detect your city. You can also search for it instead.'),
        blocked: t('location.permission_blocked', 'Location permission is turned off for MotionMeet. Enable it in Settings, or search for your city instead.'),
        services_off: t('location.services_off', 'Location services are switched off on this device. Turn them on, or search for your city instead.'),
        unavailable: t('location.fix_unavailable', 'Your position could not be read right now. Please try again, or search for your city.'),
        timeout: t('location.fix_timeout', 'Reading your position took too long. Please try again, or search for your city.'),
      };
      showError(t('location.current_failed', 'Could not detect your location'), messages[result.outcome] ?? messages.unavailable);
      if (result.outcome === 'blocked') await openSettings();
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;
      const response = await resolveCoordinates({ latitude: result.fix.latitude, longitude: result.fix.longitude }, token, locale);
      if (!response.success || !response.suggestion) {
        showError(
          t('location.current_failed', 'Could not detect your location'),
          t('location.no_match', 'No known place matched your position. Please search for your city instead.'),
        );
        return;
      }
      setProposal(response.suggestion);
    } catch (error) {
      showError(t('common.error', 'Error'), getUserFacingError(error));
    }
  }, [getToken, locale, openSettings, requestFix, t]);

  const listed = trimmed.length >= MIN_QUERY_LENGTH ? results : recent;
  const listHeading = trimmed.length >= MIN_QUERY_LENGTH
    ? t('location.results', 'Results')
    : recent.length
      ? t('location.recent', 'Recently used')
      : '';

  const renderRow = useCallback(({ item }: { item: LocationSuggestion }) => (
    <TouchableRipple onPress={() => void select(item)} disabled={saving}>
      <View style={styles.row}>
        <Text style={styles.flag}>{item.countryEmoji || '📍'}</Text>
        <View style={[styles.rowBody, { borderBottomColor: theme.border }]}>
          <Text numberOfLines={1} style={{ color: theme.text, fontSize: TYPE.row, fontWeight: '500' }}>{item.name}</Text>
          <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: TYPE.meta, marginTop: 1 }}>{item.displayName}</Text>
        </View>
      </View>
    </TouchableRipple>
  ), [saving, select, theme]);

  const emptyState = () => {
    const note = (icon: React.ComponentProps<typeof Ionicons>['name'] | null, title: string | null, body: string) => (
      <View style={styles.note}>
        {icon ? <Ionicons name={icon} size={24} color={theme.textMuted} /> : null}
        {title ? <Text style={{ color: theme.text, fontSize: TYPE.body, fontWeight: '600' }}>{title}</Text> : null}
        <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>{body}</Text>
      </View>
    );
    if (searching) {
      return (
        <View style={styles.note}>
          <ActivityIndicator color={theme.textMuted} />
        </View>
      );
    }
    if (failed) {
      return note(
        'cloud-offline-outline',
        t('location.offline_title', 'No connection'),
        t('location.offline_body', 'Locations could not be loaded. Check your connection and try again.'),
      );
    }
    if (trimmed.length >= MIN_QUERY_LENGTH) {
      return note(
        'search-outline',
        t('location.no_results_title', 'No matches'),
        t('location.no_results_body', 'Try the city name, or the province it belongs to.'),
      );
    }
    return note(null, null, t('location.hint', 'Type at least two letters to find your city, district or country.'));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      {/* The search field is the header: back on the left, the field taking
          the rest of the bar, the way Instagram's location search reads. */}
      <ScreenHeader
        title={t('location.picker_title', 'Choose location')}
        onBack={saving ? undefined : () => navigation.goBack()}
      >
        <View style={[styles.search, { backgroundColor: theme.surfaceLight }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            maxLength={80}
            placeholder={t('location.search_placeholder', 'City, district or country')}
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.clear', 'Temizle')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </ScreenHeader>

      <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        <FlatList
          data={listed}
          keyExtractor={(item) => `${item.kind}:${item.id}`}
          renderItem={renderRow}
          ListEmptyComponent={emptyState}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: (keyboard.visible ? keyboard.height : insets.bottom) + 12 }}
          ListHeaderComponent={(
            <>
              <TouchableRipple onPress={() => void detectCurrentLocation()} disabled={locating || saving}>
                <View style={styles.row}>
                  <View style={styles.flagSlot}>
                    {locating ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="navigate-outline" size={19} color={theme.primary} />}
                  </View>
                  <View style={[styles.rowBody, { borderBottomColor: theme.border }]}>
                    <Text style={{ color: theme.primary, fontSize: TYPE.row, fontWeight: '600' }}>
                      {t('location.use_current', 'Use my current location')}
                    </Text>
                    <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: TYPE.meta, marginTop: 1 }}>
                      {t('location.use_current_hint', 'Suggests a city. Nothing is saved until you confirm.')}
                    </Text>
                  </View>
                </View>
              </TouchableRipple>

              {proposal ? (
                <View style={[styles.proposal, { borderBottomColor: theme.border }]}>
                  <Text style={{ color: theme.textMuted, fontSize: TYPE.meta }}>
                    {t('location.proposal_title', 'Set your profile location to this?')}
                  </Text>
                  <Text style={{ color: theme.text, fontSize: TYPE.section, fontWeight: '600', marginTop: 2 }}>
                    {proposal.countryEmoji} {proposal.displayName}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <SoftButton primary label={t('common.confirm', 'Confirm')} busy={saving} onPress={() => void select(proposal)} />
                    <SoftButton label={t('common.cancel', 'Cancel')} onPress={() => setProposal(null)} />
                  </View>
                </View>
              ) : null}

              {listHeading ? (
                <Text style={[styles.heading, { color: theme.textMuted }]}>{listHeading}</Text>
              ) : null}
            </>
          )}
          ListFooterComponent={(
            // ODbL requires the source to stay visible wherever the data is shown.
            <Text style={[styles.attribution, { color: theme.textMuted }]}>
              {t('location.attribution', 'Place data by Countries States Cities Database · ODbL v1.0')}
            </Text>
          )}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  search: {
    flex: 1,
    height: 36,
    marginRight: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: TYPE.body, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, minHeight: 56 },
  flag: { width: 28, fontSize: 19, textAlign: 'center' },
  flagSlot: { width: 28, alignItems: 'center' },
  rowBody: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginLeft: 12,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  proposal: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { fontSize: 13, fontWeight: '600', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 2 },
  note: { alignItems: 'center', gap: 6, paddingVertical: 32, paddingHorizontal: 32 },
  attribution: { fontSize: 10.5, textAlign: 'center', marginTop: 16 },
});

export default LocationPickerScreen;
