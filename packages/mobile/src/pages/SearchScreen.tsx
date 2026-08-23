import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
// expo-image: this list scrolls past many remote avatars, and it recycles views
// and keeps a memory + disk cache where React Native's Image does not.
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { discoverUsers } from '../api/endpoints';
import { logHandledError } from '../utils/feedback';
import { mediaVariantUrl, type PublicUser } from '@motionmeet/shared';
import type { NavigationOnlyProps } from '../navigation/types';

/** Long enough that a fast typist makes one request, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 280;
/** As many recents as fit on one screen without turning into a second feed. */
const MAX_RECENTS = 12;
const RECENTS_KEY = '@mm_recent_searches';

interface RecentEntry {
  _id: string;
  full_name: string;
  username: string;
  profile_picture: string;
}

type SearchablePerson = PublicUser | RecentEntry;

const toRecent = (user: SearchablePerson): RecentEntry => ({
  _id: user._id,
  full_name: user.full_name || '',
  username: user.username || '',
  profile_picture: typeof user.profile_picture === 'string' ? user.profile_picture : '',
});

/**
 * Search, as its own place.
 *
 * It used to be a field on top of Keşfet, which meant the grid was torn down
 * and rebuilt every time someone typed a letter and there was nowhere for
 * recent searches to live. Opening the field pushes this screen instead: the
 * keyboard comes up on its own, the people you looked at before are waiting,
 * and Cancel goes back to the grid exactly where it was left.
 */
const SearchScreen = ({ navigation }: NavigationOnlyProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  const inputRef = useRef<TextInput | null>(null);
  // Only the newest search may write to the list: a slow request for "uh" must
  // not land on top of the results for "uhut".
  const searchSequence = useRef(0);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(RECENTS_KEY);
        const parsed: unknown = stored ? JSON.parse(stored) : [];
        if (Array.isArray(parsed)) setRecents(parsed.filter((entry) => entry?._id).slice(0, MAX_RECENTS));
      } catch (error) {
        logHandledError('load-recent-searches', error);
      }
    })();
  }, []);

  // The keyboard is the whole point of arriving here, so it is raised without
  // the member having to tap the field they just tapped.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  const persistRecents = useCallback(async (next: RecentEntry[]) => {
    setRecents(next);
    try {
      await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch (error) {
      logHandledError('save-recent-searches', error);
    }
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      searchSequence.current += 1;
      setResults([]);
      setSearching(false);
      return undefined;
    }

    const sequence = (searchSequence.current += 1);
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const token = await getToken();
          if (!token) return;
          const data = await discoverUsers(term, token);
          if (sequence !== searchSequence.current) return;
          setResults(data.success ? data.users || [] : []);
        } catch (error) {
          logHandledError('user-search', error);
          if (sequence === searchSequence.current) setResults([]);
        } finally {
          if (sequence === searchSequence.current) setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [getToken, query]);

  const openProfile = useCallback((user: SearchablePerson) => {
    const entry = toRecent(user);
    void persistRecents([entry, ...recents.filter((item) => item._id !== entry._id)].slice(0, MAX_RECENTS));
    Keyboard.dismiss();
    navigation.navigate('Profile', { userId: user._id });
  }, [navigation, persistRecents, recents]);

  const removeRecent = useCallback((userId: string) => {
    void persistRecents(recents.filter((entry) => entry._id !== userId));
  }, [persistRecents, recents]);

  const renderPerson = useCallback((
    user: SearchablePerson,
    { onRemove }: { onRemove?: () => void } = {},
  ) => {
    const picture = typeof user.profile_picture === 'string' ? user.profile_picture.trim() : '';
    return (
      <Pressable
        style={styles.row}
        onPress={() => openProfile(user)}
        accessibilityRole="button"
        accessibilityLabel={user.full_name || user.username}
      >
        {picture ? (
          <Image
            source={{ uri: mediaVariantUrl(picture, 'avatar') }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={user._id}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>
              {(user.full_name || user.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.rowBody}>
          <Text numberOfLines={1} style={styles.rowName}>
            {user.username || user.full_name}
          </Text>
          {user.full_name ? (
            <Text numberOfLines={1} style={styles.rowHandle}>
              {user.full_name}
            </Text>
          ) : null}
        </View>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('search.remove_recent', 'Aramayı kaldır')}
          >
            <Ionicons name="close" size={19} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
    );
  }, [openProfile, styles, t, theme.textMuted]);

  const renderResult: ListRenderItem<PublicUser> = useCallback(
    ({ item }) => renderPerson(item),
    [renderPerson],
  );

  const renderRecent: ListRenderItem<RecentEntry> = useCallback(
    ({ item }) => renderPerson(item, { onRemove: () => removeRecent(item._id) }),
    [removeRecent, renderPerson],
  );

  const hasEnoughTerm = query.trim().length >= 2;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={17} color={theme.textMuted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t('explore.search_placeholder', 'Ara')}
            placeholderTextColor={theme.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            maxLength={60}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear', 'Temizle')}
            >
              <Ionicons name="close-circle" size={17} color={theme.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            navigation.goBack();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel', 'İptal')}
        >
          <Text style={styles.cancel}>{t('common.cancel', 'İptal')}</Text>
        </Pressable>
      </View>

      {query.trim().length === 0 ? (
        <FlatList
          key="recents"
          data={recents}
          renderItem={renderRecent}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            recents.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('search.recent', 'Son aramalar')}</Text>
                <Pressable
                  onPress={() => void persistRecents([])}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('search.clear_all', 'Tümünü temizle')}
                >
                  <Text style={styles.sectionAction}>{t('search.clear_all', 'Tümünü temizle')}</Text>
                </Pressable>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={26} color={theme.textMuted} />
              <Text style={styles.emptyHint}>
                {t('search.start_hint', 'Sporcuları isim ya da kullanıcı adıyla ara.')}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          key="results"
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            searching ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
            ) : !hasEnoughTerm ? (
              <View style={styles.empty}>
                <Text style={styles.emptyHint}>
                  {t('explore.search_hint', 'Aramak için en az iki harf yaz.')}
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="person-outline" size={26} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>{t('explore.no_results', 'Sonuç bulunamadı')}</Text>
                <Text style={styles.emptyHint}>
                  {t('explore.no_results_hint', 'Kullanıcı adını ya da ismi kontrol et.')}
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: theme.surfaceLight,
  },
  searchInput: { flex: 1, minWidth: 0, color: theme.text, fontSize: 15, padding: 0 },
  cancel: { color: theme.text, fontSize: 15, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionTitle: { color: theme.text, fontSize: 15, fontWeight: '800' },
  sectionAction: { color: theme.primary, fontSize: 13, fontWeight: '700' },
  // Full bleed, like every people list in the app: no card, no side gutter
  // beyond the text inset.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.surfaceLight },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: theme.text, fontSize: 18, fontWeight: '800' },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: theme.text, fontSize: 14.5, fontWeight: '700' },
  rowHandle: { color: theme.textMuted, fontSize: 12.5, marginTop: 1 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
  emptyHint: { color: theme.textMuted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
});

export default SearchScreen;
