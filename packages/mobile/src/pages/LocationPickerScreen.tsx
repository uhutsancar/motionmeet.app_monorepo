import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Divider, Surface, Text, TextInput, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Localization from 'expo-localization';
import { useTranslation } from 'react-i18next';
import type { LocationSuggestion } from '@motionmeet/shared';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
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
  const { horizontalPadding } = useResponsiveLayout();
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

  const inputTheme = useMemo(
    () => ({ colors: { primary: theme.primary, background: theme.surfaceLight, onSurfaceVariant: theme.textMuted } }),
    [theme],
  );

  const renderRow = useCallback(({ item }: { item: LocationSuggestion }) => (
    <TouchableRipple onPress={() => void select(item)} disabled={saving}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 }}>
        <Text style={{ fontSize: 20 }}>{item.countryEmoji || '📍'}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>{item.name}</Text>
          <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 2 }}>{item.displayName}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </View>
    </TouchableRipple>
  ), [saving, select, theme]);

  const emptyState = () => {
    if (searching) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
          <ActivityIndicator color={theme.primary} />
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>{t('location.searching', 'Searching…')}</Text>
        </View>
      );
    }
    if (failed) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6, paddingHorizontal: 24 }}>
          <Ionicons name="cloud-offline-outline" size={26} color={theme.textMuted} />
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>{t('location.offline_title', 'No connection')}</Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>
            {t('location.offline_body', 'Locations could not be loaded. Check your connection and try again.')}
          </Text>
        </View>
      );
    }
    if (trimmed.length >= MIN_QUERY_LENGTH) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6, paddingHorizontal: 24 }}>
          <Ionicons name="search-outline" size={26} color={theme.textMuted} />
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>{t('location.no_results_title', 'No matches')}</Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>
            {t('location.no_results_body', 'Try the city name, or the province it belongs to.')}
          </Text>
        </View>
      );
    }
    return (
      <View style={{ alignItems: 'center', paddingVertical: 32, gap: 6, paddingHorizontal: 24 }}>
        <Ionicons name="location-outline" size={26} color={theme.textMuted} />
        <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>
          {t('location.hint', 'Type at least two letters to find your city, district or country.')}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right', 'bottom']}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} disabled={saving} />
        <Appbar.Content
          title={t('location.picker_title', 'Choose location')}
          titleStyle={{ color: theme.text, fontWeight: '800', fontSize: 19 }}
        />
      </Appbar.Header>

      <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: horizontalPadding, paddingTop: 12 }}>
        <TextInput
          mode="outlined"
          autoFocus
          value={query}
          onChangeText={setQuery}
          maxLength={80}
          placeholder={t('location.search_placeholder', 'City, district or country')}
          left={<TextInput.Icon icon="magnify" color={theme.textMuted} />}
          right={query ? <TextInput.Icon icon="close" onPress={() => setQuery('')} color={theme.textMuted} /> : undefined}
          theme={inputTheme}
          textColor={theme.text}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />

        <TouchableRipple onPress={() => void detectCurrentLocation()} disabled={locating || saving} style={{ borderRadius: 12, marginTop: 12 }}>
          <Surface
            elevation={0}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 11,
              paddingHorizontal: 14, paddingVertical: 13,
              borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
            }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: `${theme.primary}18` }}>
              {locating ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="navigate" size={17} color={theme.primary} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '800' }}>
                {t('location.use_current', 'Use my current location')}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>
                {t('location.use_current_hint', 'Suggests a city. Nothing is saved until you confirm.')}
              </Text>
            </View>
          </Surface>
        </TouchableRipple>

        {proposal ? (
          <Surface
            elevation={0}
            style={{
              marginTop: 12, padding: 14, borderRadius: 12, gap: 10,
              borderWidth: 1, borderColor: `${theme.primary}55`, backgroundColor: theme.primarySoft,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 12.5, fontWeight: '700' }}>
              {t('location.proposal_title', 'Set your profile location to this?')}
            </Text>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>
              {proposal.countryEmoji} {proposal.displayName}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableRipple
                onPress={() => void select(proposal)}
                disabled={saving}
                style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: theme.primary }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>{t('common.confirm', 'Confirm')}</Text>
              </TouchableRipple>
              <TouchableRipple
                onPress={() => setProposal(null)}
                style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.border }}
              >
                <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '800' }}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableRipple>
            </View>
          </Surface>
        ) : null}

        {listHeading ? (
          <Text style={{ color: theme.textMuted, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1, marginTop: 18, marginBottom: 8, marginLeft: 4 }}>
            {listHeading.toUpperCase()}
          </Text>
        ) : <View style={{ height: 18 }} />}

        <Surface
          elevation={0}
          style={{ flex: 1, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}
        >
          <FlatList
            data={listed}
            keyExtractor={(item) => `${item.kind}:${item.id}`}
            renderItem={renderRow}
            ItemSeparatorComponent={() => <Divider />}
            ListEmptyComponent={emptyState}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
        </Surface>

        {/* ODbL requires the source to stay visible wherever the data is shown. */}
        <Text style={{ color: theme.textMuted, fontSize: 9.5, textAlign: 'center', marginTop: 10, marginBottom: 6 }}>
          {t('location.attribution', 'Place data by Countries States Cities Database · ODbL v1.0')}
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default LocationPickerScreen;
