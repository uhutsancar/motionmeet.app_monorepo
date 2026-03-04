import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Image, Alert, ActivityIndicator, ActionSheetIOS, Platform, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import api, { setAuthToken } from '../api/client';
import moment from 'moment';

const VISIBILITY_OPTIONS = ['public', 'followers', 'private'];

const WorkoutSummaryScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  
  const VISIBILITY_LABELS = { 
    public: t('workout_summary.everyone', 'Herkese Açık'), 
    followers: t('workout_summary.friends', 'Takipçiler'), 
    private: t('workout_summary.only_me', 'Gizli') 
  };
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);
  const kbAppearance = isDark ? 'dark' : 'light';
  const { getToken } = useAuth();

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

  // ── Media Picker ──────────────────────────────────────────────────
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
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.length > 0) {
            setMediaUri(result.assets[0].uri);
          }
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
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.length > 0) {
            setMediaUri(result.assets[0].uri);
          }
        }
      },
      { text: t('common.cancel', 'İptal'), style: 'cancel' }
    ]);
  };

  const removeMedia = () => setMediaUri(null);

  // ── Visibility Picker ─────────────────────────────────────────────
  const pickVisibility = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...VISIBILITY_OPTIONS.map(k => VISIBILITY_LABELS[k]), t('common.cancel', 'İptal')], cancelButtonIndex: 3 },
        (idx) => { if (idx < 3) setVisibility(VISIBILITY_OPTIONS[idx]); }
      );
    } else {
      Alert.alert(t('settings.visibility', 'Görünürlük'), '', VISIBILITY_OPTIONS.map(key => ({
        text: VISIBILITY_LABELS[key],
        onPress: () => setVisibility(key),
        style: visibility === key ? 'destructive' : 'default'
      })).concat([{ text: t('common.cancel', 'İptal'), style: 'cancel' }]));
    }
  };

  // ── Save Workout ──────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setSaving(true);
      const freshToken = await getToken();
      if (freshToken) setAuthToken(freshToken);

      // 1. Save the workout to database
      const workoutPayload = {
        name: workoutData.name || t('workout.my_workout', 'Antrenmanım'),
        durationMinutes: Math.round((workoutData.duration || 0) / 60),
        volumeKg: workoutData.totalVolume || 0,
        startTime: new Date(Date.now() - (workoutData.duration || 0) * 1000),
        endTime: new Date(),
        exercises: workoutData.exercises || [],
      };
      const { data: workoutRes } = await api.post('/api/workout', workoutPayload);
      if (!workoutRes.success) {
        Alert.alert(t('common.error'), workoutRes.message || t('common.error', 'Kaydedilemedi'));
        return;
      }

      const savedWorkoutId = workoutRes.workout?._id;

      // 2. ALWAYS create a workout post (visibility controls who sees it)
      try {
        if (mediaUri) {
          // With photo → multipart/form-data
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

          await api.post('/api/post/add', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } else {
          // No photo → JSON post with workout reference
          await api.post('/api/post/add', {
            content: note.trim() || '',
            post_type: 'workout',
            visibility,
            workout: savedWorkoutId,
          });
        }
      } catch (postErr) {
        console.warn('Workout post oluşturulamadı (antrenman yine kaydedildi):', postErr.response?.data || postErr.message);
      }

      Alert.alert(
        t('common.success', 'Başarılı'),
        t('workout.saved', 'Antrenman kaydedildi!'),
        [{ text: 'Tamam', onPress: () => navigation.navigate('Tabs') }]
      );
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('workout.save_workout', 'Antrenmanı Kaydet')}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>{t('common.save', 'Kaydet')}</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* Workout Name */}
        <View style={styles.titleRow}>
          <Text style={styles.workoutName}>{workoutData.name || t('workout.my_workout', 'Antrenmanım')}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{t('statistics.duration', 'Süre')}</Text>
            <Text style={styles.statValueBlue}>{stats.duration}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{t('statistics.volume', 'Hacim')}</Text>
            <Text style={styles.statValue}>{stats.volume}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{t('statistics.sets', 'Set')}</Text>
            <Text style={styles.statValue}>{stats.sets}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('workout.when', 'Ne Zaman')}</Text>
          <Text style={styles.dateText}>{moment(stats.date).format('D MMM YYYY, HH:mm')}</Text>
        </View>

        <View style={styles.divider} />

        {/* Media upload */}
        {mediaUri ? (
          <View style={styles.mediaPreviewContainer}>
            <Image source={{ uri: mediaUri }} style={styles.mediaPreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removeMediaBtn} onPress={removeMedia}>
              <Ionicons name="close-circle" size={26} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.mediaUploadBox} onPress={pickMedia}>
            <View style={styles.dashedBox}>
              <Ionicons name="image-outline" size={28} color={theme.text} />
              <View style={styles.plusOverlay}>
                <Ionicons name="add" size={12} color={theme.background} />
              </View>
            </View>
            <Text style={styles.mediaUploadText}>{t('workout.add_photo_video', 'Bir fotoğraf / video ekle')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        {/* Note */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('workout.description', 'Açıklama')}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('workout.note_placeholder', 'Antrenmanınız nasıl geçti? Buraya birkaç not bırakın...')}
            placeholderTextColor={theme.textMuted}
            multiline
            value={note}
            onChangeText={setNote}
            keyboardAppearance={kbAppearance}
          />
        </View>

        <View style={styles.divider} />

        {/* Visibility */}
        <TouchableOpacity style={styles.listItem} onPress={pickVisibility}>
          <Text style={styles.listItemText}>{t('settings.visibility', 'Görünürlük')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.listItemValue}>{VISIBILITY_LABELS[visibility]}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Exercise summary */}
        {workoutData.exercises?.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('workout.exercises', 'Egzersizler')}</Text>
              {workoutData.exercises.map((ex, i) => (
                <View key={i} style={styles.exerciseSummaryRow}>
                  <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 14 }}>{ex.name}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                    {ex.sets.length} {t('statistics.sets', 'set')}
                    {ex.sets[0]?.weight ? ` • ${ex.sets[0].weight}kg` : ''}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.divider} />
          </>
        )}

        {/* Delete */}
        <TouchableOpacity style={[styles.listItem, { justifyContent: 'center', marginTop: 20 }]} onPress={handleDiscard}>
          <Text style={styles.deleteText}>{t('workout.delete', 'Antrenmanı Sil')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.surface
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
  saveBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 64, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  workoutName: { fontSize: 22, fontWeight: 'bold', color: theme.text },
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 10 },
  statItem: { flex: 1 },
  statLabel: { fontSize: 13, color: theme.textMuted, marginBottom: 4 },
  statValue: { fontSize: 16, color: theme.text, fontWeight: '600' },
  statValueBlue: { fontSize: 16, color: '#3b82f6', fontWeight: '600' },
  divider: { height: 1, backgroundColor: theme.border, marginTop: 16, marginBottom: 16 },
  section: {},
  sectionTitle: { fontSize: 12, color: theme.textMuted, marginBottom: 6, fontWeight: '600', textTransform: 'uppercase' },
  dateText: { fontSize: 16, color: '#3b82f6', fontWeight: '500' },
  mediaPreviewContainer: { position: 'relative', marginBottom: 8 },
  mediaPreview: { width: '100%', height: 200, borderRadius: 16 },
  removeMediaBtn: { position: 'absolute', top: 8, right: 8 },
  mediaUploadBox: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  dashedBox: { width: 60, height: 60, borderRadius: 12, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  plusOverlay: { position: 'absolute', right: -4, top: -4, backgroundColor: theme.text, borderRadius: 10, padding: 2 },
  mediaUploadText: { marginLeft: 20, fontSize: 16, color: theme.text },
  textInput: { fontSize: 16, color: theme.text, minHeight: 60, textAlignVertical: 'top' },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listItemText: { fontSize: 16, color: theme.text, fontWeight: '500' },
  listItemValue: { fontSize: 16, color: theme.textMuted },
  deleteText: { color: '#ef4444', fontSize: 16, fontWeight: '500' },
  exerciseSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border + '50' }
});

export default WorkoutSummaryScreen;
