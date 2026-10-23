import React, { useRef, useState } from 'react';
import {
  View, Image, Alert, StyleSheet, type AlertButton,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { useAuthContext } from "../context/AuthProvider";
import * as ImagePicker from 'expo-image-picker';
import { setAuthToken } from '../api/client';
import { createWorkout, createPost } from '../api/endpoints';
import { uploadMedia } from '../api/mediaUpload';
import dayjs from '../utils/dayjs';

import { Button, Surface, Text, TextInput, Divider, List, IconButton, ActivityIndicator } from 'react-native-paper';
import { EXERCISE_THUMB, exerciseThumbStyle } from '../config/layout';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import ScreenHeader from '../components/ScreenHeader';
import WorkoutShareSheet from '../components/WorkoutShareSheet';
import { WEB_URL } from '../config/environment';
import { useAppSelector } from '../store/hooks';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showInfo,
  showSuccess,
} from '../utils/feedback';
import {
  CONTENT_LIMITS,
  buildPostShareUrl,
  createOperationId,
  workoutToShareCardData,
  type PostVisibility,
  type ShareCardData,
} from '@motionmeet/shared';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { NavigationProp, ParamListBase, RouteProp } from '@react-navigation/native';
import type { WorkoutSummaryData } from '../types/workoutDraft';
import { clearActiveWorkoutDraft } from '../features/workout/activeWorkoutDraft';

interface WorkoutSummaryProps { navigation: NavigationProp<ParamListBase>; route: RouteProp<ParamListBase> }
interface UploadedMedia { signature: string; key: string }
type WorkoutRequest = Record<string, unknown> & { operationId: string };

const VISIBILITY_OPTIONS: PostVisibility[] = ['public', 'followers', 'private'];

const WorkoutSummaryScreen = ({ navigation, route }: WorkoutSummaryProps) => {
  const { t } = useTranslation();
  
  const VISIBILITY_LABELS: Record<PostVisibility, string> = {
    public: t('workout_summary.everyone', 'Herkese Açık'), 
    followers: t('workout_summary.friends', 'Takipçiler'), 
    private: t('workout_summary.only_me', 'Gizli') 
  };
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { getToken } = useAuthContext();
  const { horizontalPadding, isNarrow } = useResponsiveLayout();
  const currentUser = useAppSelector((state) => state.user.value);

  const routeParams = route.params as { workoutData?: WorkoutSummaryData; operationId?: string; startedAt?: number } | undefined;
  const workoutData: WorkoutSummaryData = routeParams?.workoutData ?? {
    name: '',
    note: '',
    duration: 0,
    totalVolume: 0,
    totalSets: 0,
    exercises: [],
  };

  const [note, setNote] = useState(workoutData.note || '');
  const [mediaAsset, setMediaAsset] = useState<ImagePickerAsset | null>(null);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [saving, setSaving] = useState(false);
  /* Filled in once the workout is on the server, which is what opens the share
     sheet. Until then there is nothing to make a card of. */
  const [shareCard, setShareCard] = useState<{
    data: ShareCardData;
    workoutId: string;
    postId: string | null;
  } | null>(null);
  const savedWorkoutIdRef = useRef<string | null>(null);
  // Comes from the stored draft, so a save retried after the app was killed
  // mid-request finds the first attempt instead of making a second workout.
  const workoutOperationIdRef = useRef(routeParams?.operationId ?? createOperationId('workout'));
  const ownerId = currentUser?._id ?? null;
  const workoutPayloadRef = useRef<WorkoutRequest | null>(null);
  const postOperationIdRef = useRef(createOperationId('post'));
  const uploadedMediaRef = useRef<UploadedMedia | null>(null);

  const updateMediaAsset = (asset: ImagePickerAsset | null) => {
    if (saving) return;
    setMediaAsset(asset);
    postOperationIdRef.current = createOperationId('post');
    uploadedMediaRef.current = null;
  };

  // Format duration for display
  const formatDuration = (secs: number): string => {
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
    if (saving) return;
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
          if (!result.canceled && result.assets?.length > 0) updateMediaAsset(result.assets[0]);
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
          if (!result.canceled && result.assets?.length > 0) updateMediaAsset(result.assets[0]);
        }
      },
      { text: t('common.cancel', 'İptal'), style: 'cancel' }
    ]);
  };

  const pickVisibility = () => {
    if (saving) return;
    const buttons: AlertButton[] = [...VISIBILITY_OPTIONS.map((key): AlertButton => ({
      text: VISIBILITY_LABELS[key],
      onPress: () => {
        setVisibility(key);
        postOperationIdRef.current = createOperationId('post');
      },
      style: visibility === key ? 'destructive' : 'default',
    })), { text: t('common.cancel', 'İptal'), style: 'cancel' }];
    Alert.alert(t('settings.visibility', 'Görünürlük'), '', buttons);
  };

  const handleSave = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const freshToken = await getToken();
      if (!freshToken) throw new Error('Authentication required');
      setAuthToken(freshToken);

      let savedWorkoutId = savedWorkoutIdRef.current;
      if (!savedWorkoutId) {
        const startTime = routeParams?.startedAt ?? Date.now() - (workoutData.duration || 0) * 1000;
        workoutPayloadRef.current ||= {
          operationId: workoutOperationIdRef.current,
          name: workoutData.name || t('workout.my_workout', 'Antrenmanım'),
          durationMinutes: Math.round((workoutData.duration || 0) / 60),
          volumeKg: workoutData.totalVolume || 0,
          startTime: new Date(startTime),
          endTime: new Date(startTime + (workoutData.duration || 0) * 1000),
          exercises: workoutData.exercises || [],
        };
        const workoutPayload = workoutPayloadRef.current;
        const workoutRes = await createWorkout(workoutPayload, freshToken);
        if (!workoutRes.success) {
          showError(
            t('common.error'),
            workoutRes.message || t('workout.save_failed', 'Antrenman kaydedilemedi.'),
          );
          return;
        }
        savedWorkoutId = workoutRes.workout?._id ?? null;
        if (!savedWorkoutId) throw new Error('Workout response did not include an identifier');
        savedWorkoutIdRef.current = savedWorkoutId;
        // The server has it now; whatever happens to the post below, there is
        // nothing left on the device to resume.
        if (ownerId) void clearActiveWorkoutDraft(ownerId).catch((error) => logHandledError('clear-workout-draft', error));
      }

      let postError: unknown = null;
      let createdPostId: string | null = null;

      try {
        if (mediaAsset) {
          const mediaSignature = `${mediaAsset.assetId || mediaAsset.uri}:${mediaAsset.fileSize || 0}`;
          let uploadedKey = uploadedMediaRef.current?.signature === mediaSignature
            ? uploadedMediaRef.current.key
            : null;
          if (!uploadedKey) {
            uploadedKey = await uploadMedia(mediaAsset, 'posts', freshToken);
            uploadedMediaRef.current = { signature: mediaSignature, key: uploadedKey };
          }
          const postResponse = await createPost({
            operationId: postOperationIdRef.current,
            content: note.trim() || '',
            post_type: 'workout',
            visibility,
            workout: savedWorkoutId,
            uploadedKeys: [uploadedKey],
          }, freshToken);
          if (!postResponse.success) throw new Error(postResponse.message || 'Workout post could not be created');
          createdPostId = postResponse.post?._id ?? null;
        } else {
          const postResponse = await createPost({
            operationId: postOperationIdRef.current,
            content: note.trim() || '',
            post_type: 'workout',
            visibility,
            workout: savedWorkoutId,
          }, freshToken);
          if (!postResponse.success) throw new Error(postResponse.message || 'Workout post could not be created');
          createdPostId = postResponse.post?._id ?? null;
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
        return;
      }

      showSuccess(t('common.success', 'Başarılı'), t('workout.saved', 'Antrenman kaydedildi!'));

      /* A finished session is the moment someone wants to post about it, so the
         card is offered here rather than being something to go and find later.
         Leaving is one tap away; nothing is blocked behind it. */
      setShareCard({
        workoutId: savedWorkoutId,
        postId: visibility === 'public' ? createdPostId : null,
        data: workoutToShareCardData(
          {
            name: workoutData.name || t('workout.my_workout', 'Antrenmanım'),
            startTime: new Date(Date.now() - (workoutData.duration || 0) * 1000).toISOString(),
            durationMinutes: Math.round((workoutData.duration || 0) / 60),
            volumeKg: workoutData.totalVolume || 0,
            totalSets: workoutData.totalSets || 0,
            exercises: (workoutData.exercises || []).map((exercise) => ({
              exerciseName: exercise.name,
              sets: exercise.sets ?? [],
              // Carried through so the card can draw the kit each movement used
              // and shade the body diagram with what the session worked.
              equipment: exercise.equipment,
              muscleGroup: exercise.muscleGroup,
            })),
          },
          currentUser?.username || currentUser?.full_name || 'motionmeet',
          {
            duration: t('workout_summary.duration', 'Süre'),
            volume: t('workout_summary.volume', 'Hacim'),
            sets: t('workout_summary.sets', 'Set'),
            untitled: t('workout.my_workout', 'Antrenmanım'),
          },
        ),
      });
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
    if (saving) return;
    const workoutAlreadySaved = Boolean(savedWorkoutIdRef.current);
    Alert.alert(
      workoutAlreadySaved
        ? t('workout.leave_summary_title', 'Paylaşmadan çık')
        : t('workout.discard_title', 'Antrenmanı sil'),
      workoutAlreadySaved
        ? t('workout.leave_summary_saved', 'Antrenman kaydedildi ancak gönderi paylaşılmadı. Bu ekrandan çıkmak istiyor musun?')
        : t('workout.discard_msg', 'Bu antrenman kaydedilmeyecek. Emin misin?'),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        {
          text: workoutAlreadySaved
            ? t('common.leave', 'Çık')
            : t('common.delete', 'Sil'),
          style: 'destructive',
          onPress: () => {
            if (!workoutAlreadySaved && ownerId) {
              void clearActiveWorkoutDraft(ownerId).catch((error) => logHandledError('clear-workout-draft', error));
            }
            navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
          },
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={t('workout.save_workout', 'Antrenmanı Kaydet')}
        onBack={saving ? undefined : handleDiscard}
        trailing={
          saving ? (
            <ActivityIndicator size="small" color={theme.primary} style={styles.activityIndicator} />
          ) : (
            <Button mode="contained" compact onPress={handleSave} style={styles.saveButton}>
              {t('common.save', 'Kaydet')}
            </Button>
          )
        }
      />

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
              {dayjs(stats.date).format('D MMM YYYY, HH:mm')}
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
                onPress={() => updateMediaAsset(null)}
                disabled={saving}
              />
            </View>
          ) : (
            <Surface style={styles.cardSurface} elevation={1}>
              <List.Item
                title={t('workout.add_photo_video', 'Bir fotoğraf / video ekle')}
                titleStyle={styles.listItemTitle}
                left={props => <List.Icon {...props} icon="image-plus" color={theme.textMuted} />}
                onPress={pickMedia}
                disabled={saving}
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
              editable={!saving}
              maxLength={CONTENT_LIMITS.post}
              onChangeText={(value) => {
                setNote(value);
                postOperationIdRef.current = createOperationId('post');
              }}
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
              disabled={saving}
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
                      /* The movement's own artwork, the way the active workout
                         and every browse list show it. The last screen before a
                         session is saved was reading as a wall of names. */
                      left={() => (
                        <View style={styles.exerciseThumb}>
                          {ex.imageUrl ? (
                            <Image source={{ uri: ex.imageUrl }} style={styles.exerciseThumbImage} resizeMode="cover" />
                          ) : (
                            <List.Icon icon="dumbbell" color={theme.textMuted} style={styles.exerciseThumbIcon} />
                          )}
                        </View>
                      )}
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
          <Button mode="text" textColor="#ef4444" onPress={handleDiscard} disabled={saving} style={styles.deleteButton}>
            {savedWorkoutIdRef.current
              ? t('workout.leave_without_sharing', 'Paylaşmadan çık')
              : t('workout.delete', 'Antrenmanı sil')}
          </Button>

        </KeyboardAwareScrollView>

      <WorkoutShareSheet
        visible={Boolean(shareCard)}
        data={shareCard?.data ?? null}
        workoutId={shareCard?.workoutId ?? null}
        shareUrl={shareCard?.postId ? buildPostShareUrl(WEB_URL, shareCard.postId) : null}
        onClose={() => {
          setShareCard(null);
          navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
        }}
      />
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  flex1: { flex: 1 },
  header: { backgroundColor: theme.background, elevation: 0 },
  headerTitle: { fontSize: 16.5, fontWeight: '700', color: theme.text },
  activityIndicator: { marginRight: 16 },
  saveButton: { marginRight: 8, borderRadius: 8 },
  scrollContent: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 60 },
  workoutName: { color: theme.text, fontWeight: '700', marginTop: 16 },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 12 },
  statsContainerNarrow: { gap: 8 },
  statCard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.surfaceLight },
  statCardNarrow: { minWidth: 88, paddingHorizontal: 8 },
  statLabel: { color: theme.textMuted },
  statValuePrimary: { color: theme.primary, fontWeight: '700', marginTop: 4 },
  statValue: { color: theme.text, fontWeight: '700', marginTop: 4 },
  divider: { marginVertical: 20, backgroundColor: theme.border },
  sectionTitle: { color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  sectionTitleBottomMargin: { color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  sectionTitleBottomMargin12: { color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 },
  dateValue: { color: theme.primary, fontWeight: '600' },
  mediaContainer: { position: 'relative' },
  mediaImage: { width: '100%', height: 200, borderRadius: 16 },
  mediaCloseButton: { position: 'absolute', top: 0, right: 0, backgroundColor: theme.surface, margin: 8 },
  cardSurface: { borderRadius: 16, backgroundColor: theme.surfaceLight },
  listItemPadding: { paddingVertical: 12 },
  listItemTitle: { color: theme.text, fontWeight: '500' },
  listItemTitleBold: { color: theme.text, fontWeight: '700' },
  listItemDescription: { color: theme.textMuted },
  textInputStyle: { backgroundColor: theme.surfaceLight, width: '100%', minWidth: 0, fontSize: 14 },
  exercisesContainer: { marginBottom: 20 },
  cardInner: { overflow: 'hidden', borderRadius: 16 },
  exerciseItem: { borderBottomWidth: 1, alignItems: 'center' },
  exerciseThumb: {
    ...exerciseThumbStyle(EXERCISE_THUMB.medium),
    marginLeft: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  exerciseThumbImage: { width: '100%', height: '100%' },
  exerciseThumbIcon: { margin: 0 },
  exerciseItemLast: { borderBottomWidth: 0 },
  deleteButton: { marginTop: 8 },
});

export default WorkoutSummaryScreen;
