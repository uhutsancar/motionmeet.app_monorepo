import React, { useState } from 'react';
import {
  View, ScrollView, Image, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from "../context/AuthProvider";
import * as ImagePicker from 'expo-image-picker';
import { setAuthToken } from '../api/client';
import { createWorkout, createPost } from '../api/endpoints';
import moment from 'moment';
import { Appbar, Button, Surface, Text, TextInput, Divider, List, IconButton, ActivityIndicator } from 'react-native-paper';

const VISIBILITY_OPTIONS = ['public', 'followers', 'private'];

const WorkoutSummaryScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  
  const VISIBILITY_LABELS = { 
    public: t('workout_summary.everyone', 'Herkese Açık'), 
    followers: t('workout_summary.friends', 'Takipçiler'), 
    private: t('workout_summary.only_me', 'Gizli') 
  };
  const { theme, isDark } = useTheme();
  const { getToken } = useAuthContext();

  const workoutData = route?.params?.workoutData || {};

  const [note, setNote] = useState(workoutData.note || '');
  const [mediaUri, setMediaUri] = useState(null);
  const [visibility, setVisibility] = useState('public');
  const [saving, setSaving] = useState(false);

  // Format duration for display
  const formatDuration = (secs) => {
    if (!secs) return '0min';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}s ${m}dk`;
    if (m > 0) return `${m}dk ${s}sn`;
    return `${s}sn`;
  };

  const stats = {
    duration: formatDuration(workoutData.duration),
    volume: `${workoutData.totalVolume || 0} kg`,
    sets: workoutData.totalSets || 0,
    date: new Date()
  };

  const pickMedia = () => {
    Alert.alert(t('workout.add_photo_title', 'Fotoğraf Ekle'), '', [
      {
        text: t('workout.take_photo', 'Fotoğraf Çek'),
        onPress: async () => {
          const camPerm = await ImagePicker.requestCameraPermissionsAsync();
          if (camPerm.status !== 'granted') {
            Alert.alert(t('common.error', 'Hata'), t('workout.camera_permission', 'Kamera izni gerekiyor'));
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
          if (!result.canceled && result.assets?.length > 0) setMediaUri(result.assets[0].uri);
        }
      },
      {
        text: t('workout.choose_from_gallery', 'Galeriden Seç'),
        onPress: async () => {
          const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (libPerm.status !== 'granted') {
            Alert.alert(t('common.error', 'Hata'), t('workout.gallery_permission', 'Galeri izni gerekiyor'));
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
          if (!result.canceled && result.assets?.length > 0) setMediaUri(result.assets[0].uri);
        }
      },
      { text: t('common.cancel', 'İptal'), style: 'cancel' }
    ]);
  };

  const pickVisibility = () => {
    Alert.alert(t('settings.visibility', 'Görünürlük'), '', VISIBILITY_OPTIONS.map(key => ({
      text: VISIBILITY_LABELS[key],
      onPress: () => setVisibility(key),
      style: visibility === key ? 'destructive' : 'default'
    })).concat([{ text: t('common.cancel', 'İptal'), style: 'cancel' }]));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const freshToken = await getToken();
      if (freshToken) setAuthToken(freshToken);

      const workoutPayload = {
        name: workoutData.name || t('workout.my_workout', 'Antrenmanım'),
        durationMinutes: Math.round((workoutData.duration || 0) / 60),
        volumeKg: workoutData.totalVolume || 0,
        startTime: new Date(Date.now() - (workoutData.duration || 0) * 1000),
        endTime: new Date(),
        exercises: workoutData.exercises || [],
      };
      const workoutRes = await createWorkout(workoutPayload, freshToken);
      if (!workoutRes.success) {
        Alert.alert(t('common.error'), workoutRes.message || t('common.error', 'Kaydedilemedi'));
        return;
      }

      const savedWorkoutId = workoutRes.workout?._id;

      try {
        if (mediaUri) {
          const formData = new FormData();
          formData.append('content', note.trim() || '');
          formData.append('post_type', 'workout');
          formData.append('visibility', visibility);
          if (savedWorkoutId) formData.append('workout', savedWorkoutId);

          const ext = mediaUri.split('.').pop()?.toLowerCase() || 'jpg';
          formData.append('images', {
            uri: mediaUri,
            name: `workout_${Date.now()}.${ext}`,
            type: `image/${ext === 'jpg' ? 'jpeg' : ext}`
          });

          await createPost(formData, freshToken);
        } else {
          await createPost({
            content: note.trim() || '',
            post_type: 'workout',
            visibility,
            workout: savedWorkoutId,
          }, freshToken);
        }
      } catch (postErr) {
        console.warn('Workout post oluşturulamadı:', postErr.response?.data || postErr.message);
      }

      Alert.alert(t('common.success', 'Başarılı'), t('workout.saved', 'Antrenman kaydedildi!'), [{ text: 'Tamam', onPress: () => navigation.navigate('Tabs') }]);
    } catch (error) {
      console.error('Workout save error:', error.response?.data || error.message);
      Alert.alert(t('common.error'), error.response?.data?.message || error.message || t('common.error', 'Bir hata oluştu'));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      t('workout.discard_title', 'Antrenmanı Sil'),
      t('workout.discard_msg', 'Bu antrenman kaydedilmeyecek. Emin misin?'),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        { text: t('common.delete', 'Sil'), style: 'destructive', onPress: () => navigation.navigate('Tabs') }
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Appbar.Header style={{ backgroundColor: theme.background, elevation: 0 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('workout.save_workout', 'Antrenmanı Kaydet')} titleStyle={{ fontSize: 18, fontWeight: 'bold', color: theme.text }} />
        {saving ? (
          <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 16 }} />
        ) : (
          <Button mode="contained" compact onPress={handleSave} style={{ marginRight: 8, borderRadius: 8 }}>
            {t('common.save', 'Kaydet')}
          </Button>
        )}
      </Appbar.Header>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          
          <Text variant="headlineSmall" style={{ color: theme.text, fontWeight: 'bold', marginTop: 16 }}>
            {workoutData.name || t('workout.my_workout', 'Antrenmanım')}
          </Text>

          {/* Stats */}
          <View style={{ flexDirection: 'row', marginTop: 16, gap: 12 }}>
            <Surface style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.surfaceLight }} elevation={1}>
              <Text variant="labelMedium" style={{ color: theme.textMuted }}>{t('statistics.duration', 'Süre')}</Text>
              <Text variant="titleMedium" style={{ color: theme.primary, fontWeight: 'bold', marginTop: 4 }}>{stats.duration}</Text>
            </Surface>
            <Surface style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.surfaceLight }} elevation={1}>
              <Text variant="labelMedium" style={{ color: theme.textMuted }}>{t('statistics.volume', 'Hacim')}</Text>
              <Text variant="titleMedium" style={{ color: theme.text, fontWeight: 'bold', marginTop: 4 }}>{stats.volume}</Text>
            </Surface>
            <Surface style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.surfaceLight }} elevation={1}>
              <Text variant="labelMedium" style={{ color: theme.textMuted }}>{t('statistics.sets', 'Set')}</Text>
              <Text variant="titleMedium" style={{ color: theme.text, fontWeight: 'bold', marginTop: 4 }}>{stats.sets}</Text>
            </Surface>
          </View>

          <Divider style={{ marginVertical: 20, backgroundColor: theme.border }} />

          {/* Date */}
          <View>
            <Text variant="labelMedium" style={{ color: theme.textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>
              {t('workout.when', 'Ne Zaman')}
            </Text>
            <Text variant="titleMedium" style={{ color: theme.primary, fontWeight: '600' }}>
              {moment(stats.date).format('D MMM YYYY, HH:mm')}
            </Text>
          </View>

          <Divider style={{ marginVertical: 20, backgroundColor: theme.border }} />

          {/* Media upload */}
          {mediaUri ? (
            <View style={{ position: 'relative' }}>
              <Image source={{ uri: mediaUri }} style={{ width: '100%', height: 200, borderRadius: 16 }} resizeMode="cover" />
              <IconButton 
                icon="close-circle" 
                iconColor="#ef4444" 
                size={28} 
                style={{ position: 'absolute', top: 0, right: 0, backgroundColor: theme.surface, margin: 8 }} 
                onPress={() => setMediaUri(null)} 
              />
            </View>
          ) : (
            <Surface style={{ borderRadius: 16, backgroundColor: theme.surfaceLight }} elevation={1}>
              <List.Item
                title={t('workout.add_photo_video', 'Bir fotoğraf / video ekle')}
                titleStyle={{ color: theme.text, fontWeight: '500' }}
                left={props => <List.Icon {...props} icon="image-plus" color={theme.textMuted} />}
                onPress={pickMedia}
                style={{ paddingVertical: 12 }}
              />
            </Surface>
          )}

          <Divider style={{ marginVertical: 20, backgroundColor: theme.border }} />

          {/* Note */}
          <View>
            <Text variant="labelMedium" style={{ color: theme.textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('workout.description', 'Açıklama')}
            </Text>
            <TextInput
              mode="outlined"
              placeholder={t('workout.note_placeholder', 'Antrenmanınız nasıl geçti?')}
              multiline
              numberOfLines={4}
              value={note}
              onChangeText={setNote}
              style={{ backgroundColor: theme.surfaceLight }}
              outlineColor={theme.border}
              activeOutlineColor={theme.primary}
              textColor={theme.text}
            />
          </View>

          <Divider style={{ marginVertical: 20, backgroundColor: theme.border }} />

          {/* Visibility */}
          <Surface style={{ borderRadius: 16, backgroundColor: theme.surfaceLight }} elevation={1}>
            <List.Item
              title={t('settings.visibility', 'Görünürlük')}
              description={VISIBILITY_LABELS[visibility]}
              descriptionStyle={{ color: theme.textMuted }}
              left={props => <List.Icon {...props} icon={visibility === 'public' ? 'globe' : visibility === 'followers' ? 'account-multiple' : 'lock'} color={theme.textMuted} />}
              right={props => <List.Icon {...props} icon="chevron-right" color={theme.textMuted} />}
              onPress={pickVisibility}
            />
          </Surface>

          <Divider style={{ marginVertical: 20, backgroundColor: theme.border }} />

          {/* Exercise summary */}
          {workoutData.exercises?.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text variant="labelMedium" style={{ color: theme.textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12 }}>
                {t('workout.exercises', 'Egzersizler')}
              </Text>
              <Surface style={{ borderRadius: 16, backgroundColor: theme.surfaceLight, overflow: 'hidden' }} elevation={1}>
                {workoutData.exercises.map((ex, i) => (
                  <List.Item
                    key={i}
                    title={ex.name}
                    titleStyle={{ color: theme.text, fontWeight: 'bold' }}
                    description={`${ex.sets.length} ${t('statistics.sets', 'set')} ${ex.sets[0]?.weight ? ` • ${ex.sets[0].weight}kg` : ''}`}
                    descriptionStyle={{ color: theme.textMuted }}
                    style={{ borderBottomWidth: i === workoutData.exercises.length - 1 ? 0 : 1, borderBottomColor: theme.border }}
                  />
                ))}
              </Surface>
            </View>
          )}

          {/* Delete */}
          <Button mode="text" textColor="#ef4444" onPress={handleDiscard} style={{ marginTop: 8 }}>
            {t('workout.delete', 'Antrenmanı Sil')}
          </Button>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default WorkoutSummaryScreen;
