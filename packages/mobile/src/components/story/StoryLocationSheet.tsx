import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
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

interface PlaceRow {
  key: string;
  name: string;
  /** The typed text, offered as a place of its own. */
  typed?: boolean;
}

/**
 * Picks the place a story is tagged with, on a screen of its own the way
 * Instagram's location sticker does: the search field sits in the top bar
 * beside the back arrow, and everything under it is the list. What the author
 * types is the first row, so a place the phone does not know is one tap away
 * instead of behind a separate "Add" button.
 *
 * The device fix is offered as suggestions rather than attached silently: the
 * author has to tap one, so tagging a story never discloses where someone is
 * without them choosing to.
 */
const StoryLocationSheet = ({ onCancel, onPick }: StoryLocationSheetProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { requestFix, busy, openSettings } = useDeviceLocation();
  const keyboard = useKeyboardInset();
  const inputRef = useRef<TextInput>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [resolved, setResolved] = useState(false);

  /** Set when the OS will not ask for location again; the screen then offers Settings. */
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
          place.street && place.district ? `${place.street}, ${place.district}` : null,
          place.district && place.city ? `${place.district}, ${place.city}` : null,
          place.city ?? null,
          place.region ?? null,
        ])
        .filter((name): name is string => Boolean(name && name.trim()))
        .map((name) => name.slice(0, MAX_PLACE_LENGTH));
      setSuggestions([...new Set(names)].slice(0, 6));
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

  const close = () => {
    Keyboard.dismiss();
    onCancel();
  };

  const typed = query.trim();
  const lowered = typed.toLocaleLowerCase();
  const matching = typed
    ? suggestions.filter((place) => place.toLocaleLowerCase().includes(lowered))
    : suggestions;
  const rows: PlaceRow[] = [
    ...(typed && !matching.some((place) => place.toLocaleLowerCase() === lowered)
      ? [{ key: `typed:${typed}`, name: typed, typed: true }]
      : []),
    ...matching.map((place) => ({ key: place, name: place })),
  ];

  const renderRow = ({ item }: { item: PlaceRow }) => (
    <Pressable
      onPress={() => submit(item.name)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      <View style={styles.rowIcon}>
        <Ionicons name={item.typed ? 'add' : 'location-outline'} size={18} color="#FFFFFF" />
      </View>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={styles.rowTitle}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {item.typed ? t('story.location_use_typed', 'Bu adla ekle') : t('story.location_nearby', 'Yakınında')}
        </Text>
      </View>
    </Pressable>
  );

  const footer = () => {
    if (busy && !resolved) return <ActivityIndicator color="rgba(255,255,255,0.7)" style={styles.spinner} />;
    if (suggestions.length || typed) return null;
    return (
      <View style={styles.hintBlock}>
        <Text style={styles.hint}>
          {blocked
            ? t('permissions.location_blocked', 'Konum erişimi kapalı. Yakındaki yerleri görmek için ayarlardan konum iznini açman gerekiyor.')
            : t('story.location_manual_hint', 'Yakındaki yerler bulunamadı, yer adını kendin yazabilirsin.')}
        </Text>
        {blocked ? (
          <Pressable onPress={() => void openSettings()} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{t('permissions.open_settings', 'Ayarları aç')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={close}
          hitSlop={8}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Geri')}
        >
          <Ionicons name="chevron-back" size={25} color="#FFFFFF" />
        </Pressable>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder={t('story.location_search', 'Konum ara')}
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.searchInput}
            maxLength={MAX_PLACE_LENGTH}
            returnKeyType="done"
            onSubmitEditing={() => submit(query)}
            autoCorrect={false}
            selectionColor="#FFFFFF"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.clear', 'Temizle')}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.55)" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={renderRow}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // A modal window is not resized for the keyboard, so the list makes
        // room for it by hand: the last place stays reachable above the keys.
        contentContainerStyle={{ paddingBottom: (keyboard.visible ? keyboard.height : insets.bottom) + 16 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 70,
  },
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 12,
    gap: 4,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  search: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '500' },
  rowMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 1 },
  spinner: { marginTop: 28 },
  hintBlock: { paddingHorizontal: 24, paddingTop: 28, alignItems: 'center', gap: 12 },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  link: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});

export default StoryLocationSheet;
