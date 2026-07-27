import React, { useState } from 'react';
import {
  View, Image, Alert, StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from "../context/AuthProvider";
import * as ImagePicker from 'expo-image-picker';
import { setAuthToken } from '../api/client';
import { createWorkout, createPost } from '../api/endpoints';
import { uploadMedia } from '../api/mediaUpload';
import moment from 'moment';
import { Appbar, Button, Surface, Text, TextInput, Divider, List, IconButton, ActivityIndicator } from 'react-native-paper';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showInfo,
  showSuccess,
} from '../utils/feedback';

const VISIBILITY_OPTIONS = ['public', 'followers', 'private'];

const WorkoutSummaryScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  
  const VISIBILITY_LABELS = { 
    public: t('workout_summary.everyone', 'Herkese Açık'), 
    followers: t('workout_summary.friends', 'Takipçiler'), 
    private: t('workout_summary.only_me', 'Gizli') 
  };
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { getToken } = useAuthContext();
  const { horizontalPadding, isNarrow } = useResponsiveLayout();

  const workoutData = route?.params?.workoutData || {};

  const [note, setNote] = useState(workoutData.note || '');
  const [mediaAsset, setMediaAsset] = useState(null);
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
            showError(t('common.error', 'Hata'), t('workout.camera_permission', 'Kamera izni gerekiyor'));
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.length > 0) setMediaAsset(result.assets[0]);
        }
      },
      {
        text: t('workout.choose_from_gallery', 'Galeriden Seç'),
        onPress: async () => {
          const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (libPerm.status !== 'granted') {
            showError(t('common.error', 'Hata'), t('workout.gallery_permission', 'Galeri izni gerekiyor'));
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
          if (!result.canceled && result.assets?.length > 0) setMediaAsset(result.assets[0]);
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
        showError(
          t('common.error'),
          workoutRes.message || t('workout.save_failed', 'Antrenman kaydedilemedi.'),
        );
        return;
      }

      const savedWorkoutId = workoutRes.workout?._id;
      let postError = null;

      try {
        if (mediaAsset) {
          const uploadedKey = await uploadMedia(mediaAsset, 'posts', freshToken);
          await createPost({
            content: note.trim() || '',
            post_type: 'workout',
            visibility,
            workout: savedWorkoutId,
            uploadedKeys: [uploadedKey],
          }, freshToken);
        } else {
          await createPost({
            content: note.trim() || '',
            post_type: 'workout',
            visibility,
            workout: savedWorkoutId,
          }, freshToken);
        }
      } catch (postErr) {
        postError = postErr;
        logHandledError('share-workout-post', postErr);
      }

      if (postError) {
        showInfo(
          t('workout.saved_title', 'Antrenman kaydedildi'),
          getUserFacingError(
            postError,
            t(
              'workout.post_share_failed',
              'Antrenman kaydedildi ancak gönderi paylaşılamadı. Daha sonra tekrar deneyebilirsiniz.',
            ),
          ),
          { visibilityTime: 5200 },
        );
      } else {
        showSuccess(
          t('common.success', 'Başarılı'),
          t('workout.saved', 'Antrenman kaydedildi!'),
        );
      }
      navigation.navigate('Tabs');
    } catch (error) {
      logHandledError('save-workout', error);
      showError(
        t('common.error'),
        getUserFacingError(error, t('workout.save_failed', 'Antrenman kaydedilemedi.')),
      );
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <Appbar.Header style={styles.header} statusBarHeight={0}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('workout.save_workout', 'Antrenmanı Kaydet')} titleStyle={styles.headerTitle} />
        {saving ? (
          <ActivityIndicator size="small" color={theme.primary} style={styles.activityIndicator} />
        ) : (
          <Button mode="contained" compact onPress={handleSave} style={styles.saveButton}>
            {t('common.save', 'Kaydet')}
          </Button>
        )}
      </Appbar.Header>

        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalPadding },
          ]}
          extraScrollHeight={28}
          showsVerticalScrollIndicator={false}
        >
          
          <Text variant="headlineSmall" style={styles.workoutName}>
            {workoutData.name || t('workout.my_workout', 'Antrenmanım')}
          </Text>

          {/* Stats */}
          <View style={[styles.statsContainer, isNarrow && styles.statsContainerNarrow]}>
            <Surface style={[styles.statCard, isNarrow && styles.statCardNarrow]} elevation={1}>
              <Text variant="labelMedium" style={styles.statLabel}>{t('statistics.duration', 'Süre')}</Text>
              <Text variant="titleMedium" style={styles.statValuePrimary}>{stats.duration}</Text>
            </Surface>
            <Surface style={[styles.statCard, isNarrow && styles.statCardNarrow]} elevation={1}>
              <Text variant="labelMedium" style={styles.statLabel}>{t('statistics.volume', 'Hacim')}</Text>
              <Text variant="titleMedium" style={styles.statValue}>{stats.volume}</Text>
            </Surface>
            <Surface style={[styles.statCard, isNarrow && styles.statCardNarrow]} elevation={1}>
              <Text variant="labelMedium" style={styles.statLabel}>{t('statistics.sets', 'Set')}</Text>
              <Text variant="titleMedium" style={styles.statValue}>{stats.sets}</Text>
            </Surface>
          </View>

          <Divider style={styles.divider} />

          {/* Date */}
          <View>
            <Text variant="labelMedium" style={styles.sectionTitle}>
              {t('workout.when', 'Ne Zaman')}
            </Text>
            <Text variant="titleMedium" style={styles.dateValue}>
              {moment(stats.date).format('D MMM YYYY, HH:mm')}
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Media upload */}
          {mediaAsset?.uri ? (
            <View style={styles.mediaContainer}>
              <Image source={{ uri: mediaAsset.uri }} style={styles.mediaImage} resizeMode="cover" />
              <IconButton
                icon="close-circle"
                iconColor="#ef4444"
                size={28}
                style={styles.mediaCloseButton}
                onPress={() => setMediaAsset(null)}
              />
            </View>
          ) : (
            <Surface style={styles.cardSurface} elevation={1}>
              <List.Item
                title={t('workout.add_photo_video', 'Bir fotoğraf / video ekle')}
                titleStyle={styles.listItemTitle}
                left={props => <List.Icon {...props} icon="image-plus" color={theme.textMuted} />}
                onPress={pickMedia}
                style={styles.listItemPadding}
              />
            </Surface>
          )}

          <Divider style={styles.divider} />

          {/* Note */}
          <View>
            <Text variant="labelMedium" style={styles.sectionTitleBottomMargin}>
              {t('workout.description', 'Açıklama')}
            </Text>
            <TextInput
              mode="outlined"
              placeholder={t('workout.note_placeholder', 'Antrenmanınız nasıl geçti?')}
              multiline
              numberOfLines={4}
              value={note}
              onChangeText={setNote}
              style={styles.textInputStyle}
              outlineColor={theme.border}
              activeOutlineColor={theme.primary}
              textColor={theme.text}
            />
          </View>

          <Divider style={styles.divider} />

          {/* Visibility */}
          <Surface style={styles.cardSurface} elevation={1}>
            <List.Item
              title={t('settings.visibility', 'Görünürlük')}
              description={VISIBILITY_LABELS[visibility]}
              descriptionStyle={styles.listItemDescription}
              left={props => <List.Icon {...props} icon={visibility === 'public' ? 'earth' : visibility === 'followers' ? 'account-multiple' : 'lock'} color={theme.textMuted} />}
              right={props => <List.Icon {...props} icon="chevron-right" color={theme.textMuted} />}
              onPress={pickVisibility}
            />
          </Surface>

          <Divider style={styles.divider} />

          {/* Exercise summary */}
          {workoutData.exercises?.length > 0 && (
            <View style={styles.exercisesContainer}>
              <Text variant="labelMedium" style={styles.sectionTitleBottomMargin12}>
                {t('workout.exercises', 'Egzersizler')}
              </Text>
              <Surface style={styles.cardSurface} elevation={1}>
                <View style={styles.cardInner}>
                  {workoutData.exercises.map((ex, i) => (
                    <List.Item
                      key={i}
                      title={ex.name}
                      titleStyle={styles.listItemTitleBold}
                      description={`${ex.sets.length} ${t('statistics.sets', 'set')} ${ex.sets[0]?.weight ? ` • ${ex.sets[0].weight}kg` : ''}`}
                      descriptionStyle={styles.listItemDescription}
                      style={[
                        styles.exerciseItem,
                        i === workoutData.exercises.length - 1 ? styles.exerciseItemLast : { borderBottomColor: theme.border }
                      ]}
                    />
                  ))}
                </View>
              </Surface>
            </View>
          )}

          {/* Delete */}
          <Button mode="text" textColor="#ef4444" onPress={handleDiscard} style={styles.deleteButton}>
            {t('workout.delete', 'Antrenmanı Sil')}
          </Button>

        </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  flex1: { flex: 1 },
  header: { backgroundColor: theme.background, elevation: 0 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
  activityIndicator: { marginRight: 16 },
  saveButton: { marginRight: 8, borderRadius: 8 },
  scrollContent: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 60 },
  workoutName: { color: theme.text, fontWeight: 'bold', marginTop: 16 },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 12 },
  statsContainerNarrow: { gap: 8 },
  statCard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.surfaceLight },
  statCardNarrow: { minWidth: 88, paddingHorizontal: 8 },
  statLabel: { color: theme.textMuted },
  statValuePrimary: { color: theme.primary, fontWeight: 'bold', marginTop: 4 },
  statValue: { color: theme.text, fontWeight: 'bold', marginTop: 4 },
  divider: { marginVertical: 20, backgroundColor: theme.border },
  sectionTitle: { color: theme.textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  sectionTitleBottomMargin: { color: theme.textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 },
  sectionTitleBottomMargin12: { color: theme.textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12 },
  dateValue: { color: theme.primary, fontWeight: '600' },
  mediaContainer: { position: 'relative' },
  mediaImage: { width: '100%', height: 200, borderRadius: 16 },
  mediaCloseButton: { position: 'absolute', top: 0, right: 0, backgroundColor: theme.surface, margin: 8 },
  cardSurface: { borderRadius: 16, backgroundColor: theme.surfaceLight },
  listItemPadding: { paddingVertical: 12 },
  listItemTitle: { color: theme.text, fontWeight: '500' },
  listItemTitleBold: { color: theme.text, fontWeight: 'bold' },
  listItemDescription: { color: theme.textMuted },
  textInputStyle: { backgroundColor: theme.surfaceLight },
  exercisesContainer: { marginBottom: 20 },
  cardInner: { overflow: 'hidden', borderRadius: 16 },
  exerciseItem: { borderBottomWidth: 1 },
  exerciseItemLast: { borderBottomWidth: 0 },
  deleteButton: { marginTop: 8 },
});

export default WorkoutSummaryScreen;
