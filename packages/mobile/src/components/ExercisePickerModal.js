import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Searchbar,
  Surface,
  Text,
  TouchableRipple,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getExercises } from '../api/endpoints';
import { BottomSheetModal } from './ResponsiveModal';
import { resolvePublicMediaUrl } from '@motionmeet/shared';
import { API_URL } from '../config/environment';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';

const ExercisePickerModal = ({ visible, onDismiss, onSelect, excludedIds = [] }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { getToken } = useAuthContext();
  const [search, setSearch] = useState('');
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const excluded = useMemo(() => new Set(excludedIds), [excludedIds]);

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const token = await getToken();
        const data = await getExercises({ search, limit: 100 }, token);
        if (active && data.success) setExercises(data.exercises || []);
      } catch {
        if (active) setExercises([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [getToken, search, visible]);

  return (
    <BottomSheetModal
      visible={visible}
      onRequestClose={onDismiss}
      backgroundColor={theme.surface}
      heightRatio={0.82}
    >
      <Surface
        elevation={0}
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 620,
          alignSelf: 'center',
          padding: 18,
          backgroundColor: theme.surface,
        }}
      >
        <Text variant="titleLarge" style={{ color: theme.text, fontWeight: '800', marginBottom: 14 }}>
          {t('active_workout.add_exercise', 'Add exercise')}
        </Text>
        <Searchbar
          value={search}
          onChangeText={setSearch}
          placeholder={t('exercises.search', 'Search exercises')}
          style={{ backgroundColor: theme.background, marginBottom: 10 }}
        />
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={exercises}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const disabled = excluded.has(item._id);
              const mediaUrl = resolvePublicMediaUrl(item.gifUrl, API_URL);
              return (
                <TouchableRipple
                  disabled={disabled}
                  onPress={() => {
                    onSelect(item);
                    onDismiss();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('active_workout.add_exercise', 'Add exercise')}: ${item.name}`}
                >
                  <Surface elevation={0} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: 'transparent' }}>
                    <Surface elevation={0} style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: theme.surfaceLight, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                      {mediaUrl ? (
                        <Image source={{ uri: mediaUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      ) : (
                        <Ionicons name="barbell-outline" size={20} color={theme.textMuted} />
                      )}
                    </Surface>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: disabled ? theme.textMuted : theme.text, fontWeight: '700' }}>{item.name}</Text>
                      <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}>{item.muscleGroup} · {item.equipment}</Text>
                    </View>
                  </Surface>
                </TouchableRipple>
              );
            }}
          />
        )}
        <Button onPress={onDismiss} style={{ marginTop: 10 }}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </Surface>
    </BottomSheetModal>
  );
};

export default ExercisePickerModal;
