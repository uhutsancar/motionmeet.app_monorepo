import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Modal,
  Portal,
  Searchbar,
  Surface,
  Text,
  TouchableRipple,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { getExercises } from '../api/endpoints';

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
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={{
          margin: 18,
          padding: 18,
          maxHeight: '82%',
          maxWidth: 620,
          width: '92%',
          alignSelf: 'center',
          borderRadius: 20,
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
                  <Surface elevation={0} style={{ paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: 'transparent' }}>
                    <Text style={{ color: disabled ? theme.textMuted : theme.text, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}>{item.muscleGroup} · {item.equipment}</Text>
                  </Surface>
                </TouchableRipple>
              );
            }}
          />
        )}
        <Button onPress={onDismiss} style={{ marginTop: 10 }}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </Modal>
    </Portal>
  );
};

export default ExercisePickerModal;
