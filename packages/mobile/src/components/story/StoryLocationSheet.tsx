import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { logHandledError } from '../../utils/feedback';

interface StoryLocationSheetProps {
  onCancel: () => void;
  onPick: (place: string) => void;
}

/** Place names longer than this stop fitting on a sticker. */
const MAX_PLACE_LENGTH = 48;

/**
 * Picks the place a story is tagged with.
 *
 * The device fix is offered as a suggestion rather than attached silently: the
 * author has to tap it, and can type any other name instead, so tagging a story
 * never discloses where someone is without them choosing to.
 */
const StoryLocationSheet = ({ onCancel, onPick }: StoryLocationSheetProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { requestFix, busy, openSettings } = useDeviceLocation();
  const keyboard = useKeyboardInset();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [resolved, setResolved] = useState(false);

  /** Set when the OS will not ask for location again; the sheet then offers Settings. */
  const [blocked, setBlocked] = useState(false);

  const loadNearbyPlaces = useCallback(async () => {
    try {
      const { fix, outcome } = await requestFix();
      // A refusal only costs the suggestions — the place can still be typed —
      // so nothing is disabled here. A permanent block is worth a way out.
      if (outcome === 'blocked') setBlocked(true);
      if (!fix) return;
      const places = await Location.reverseGeocodeAsync({
        latitude: fix.latitude,
        longitude: fix.longitude,
      });
      const names = places
        .flatMap((place) => [
          place.name && place.city && place.name !== place.city ? `${place.name}, ${place.city}` : null,
          place.district && place.city ? `${place.district}, ${place.city}` : null,
          place.city ?? null,
          place.region ?? null,
        ])
        .filter((name): name is string => Boolean(name && name.trim()))
        .map((name) => name.slice(0, MAX_PLACE_LENGTH));
      setSuggestions([...new Set(names)].slice(0, 4));
    } catch (error) {
      logHandledError('story-location-suggestions', error);
    } finally {
      setResolved(true);
    }
  }, [requestFix]);

  useEffect(() => {
    void loadNearbyPlaces();
  }, [loadNearbyPlaces]);

  const submit = (place: string) => {
    const trimmed = place.trim().slice(0, MAX_PLACE_LENGTH);
    if (!trimmed) return;
    Keyboard.dismiss();
    onPick(trimmed);
  };

  return (
    <View style={styles.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          Keyboard.dismiss();
          onCancel();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Kapat')}
      />

      {/* The sheet rides on top of the keyboard instead of being buried by it.
          A full-screen modal window is not resized when the IME opens, so the
          space it takes has to be reserved by hand — without this the place
          field and every suggestion under it sat behind the keys. */}
      <View
        style={[
          styles.sheet,
          { paddingBottom: (keyboard.visible ? keyboard.height : Math.max(insets.bottom, 14)) + 4 },
        ]}
      >
        <View style={styles.grabber} />
        <Text style={styles.title}>{t('story.add_location', 'Konum ekle')}</Text>

        <View style={styles.searchRow}>
          <Ionicons name="location-outline" size={18} color="rgba(255,255,255,0.65)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('story.location_placeholder', 'Bir yer yaz')}
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.searchInput}
            maxLength={MAX_PLACE_LENGTH}
            returnKeyType="done"
            onSubmitEditing={() => submit(query)}
            autoCorrect={false}
          />
          {query.trim().length > 0 && (
            <Pressable onPress={() => submit(query)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.addLabel}>{t('common.add', 'Ekle')}</Text>
            </Pressable>
          )}
        </View>

        {busy && !resolved ? (
          <ActivityIndicator color="#FFFFFF" style={styles.spinner} />
        ) : suggestions.length ? (
          <View style={styles.suggestionList}>
            {suggestions.map((place) => (
              <Pressable
                key={place}
                onPress={() => submit(place)}
                style={styles.suggestionRow}
                accessibilityRole="button"
              >
                <Ionicons name="navigate-circle-outline" size={19} color="#9757FB" />
                <Text numberOfLines={1} style={styles.suggestionText}>
                  {place}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            <Text style={styles.hint}>
              {blocked
                ? t('permissions.location_blocked', 'Konum erişimi kapalı. Yakındaki yerleri görmek için ayarlardan konum iznini açman gerekiyor.')
                : t('story.location_manual_hint', 'Yakindaki yerler bulunamadi, yer adini kendin yazabilirsin.')}
            </Text>
            {blocked ? (
              <Pressable
                onPress={() => void openSettings()}
                style={styles.settingsRow}
                accessibilityRole="button"
              >
                <Ionicons name="settings-outline" size={17} color="#9757FB" />
                <Text style={styles.addLabel}>{t('permissions.open_settings', 'Ayarları aç')}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 70,
  },
  sheet: {
    backgroundColor: '#15161C',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 15,
    padding: 0,
  },
  addLabel: {
    color: '#9757FB',
    fontSize: 14,
    fontWeight: '800',
  },
  spinner: {
    marginVertical: 22,
  },
  suggestionList: {
    marginTop: 6,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  suggestionText: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  hint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12.5,
    lineHeight: 18,
    paddingVertical: 16,
  },
});

export default StoryLocationSheet;
