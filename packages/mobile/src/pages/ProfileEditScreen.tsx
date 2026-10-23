import React, { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { uploadMedia } from '../api/mediaUpload';
import { updateUser } from '../features/user/userSlice';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showSuccess,
} from '../utils/feedback';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import ScreenHeader from '../components/ScreenHeader';
import { useScrollEdge } from '../hooks/useScrollEdge';
import { TYPE } from '../config/layout';
import type { NavigationOnlyProps } from '../navigation/types';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 84;
const LABEL_WIDTH = 104;

const validateAsset = (asset: ImagePickerAsset): void => {
  if (!asset?.uri) throw new Error('Please select a valid image.');
  if (asset.mimeType && !ALLOWED_IMAGE_TYPES.has(asset.mimeType.toLowerCase())) {
    throw new Error('Use a JPG, PNG, WebP, GIF, HEIC or HEIF image.');
  }
  if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
    throw new Error('Profile images must be smaller than 5 MB.');
  }
};

interface FieldRowProps extends TextInputProps {
  label: string;
  inputRef?: React.Ref<TextInput>;
  keyboardType?: KeyboardTypeOptions;
}

/**
 * One line of the form, the way Instagram's edit screen draws it: the label in
 * a fixed column, the value beside it, a hairline under the value only. No box
 * around the field and no box around the form.
 */
const FieldRow = ({ label, inputRef, multiline, ...input }: FieldRowProps) => {
  const { theme } = useTheme();
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: theme.text }]} numberOfLines={1}>{label}</Text>
      <View style={[styles.fieldValue, { borderBottomColor: theme.border }]}>
        <TextInput
          ref={inputRef}
          {...input}
          multiline={multiline}
          placeholderTextColor={theme.textMuted}
          style={[styles.input, multiline && styles.multiline, { color: theme.text }]}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
};

const ProfileEditScreen = ({ navigation }: NavigationOnlyProps) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.value);
  const { getToken } = useAuthContext();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const headerEdge = useScrollEdge();
  const [profileAsset, setProfileAsset] = useState<ImagePickerAsset | null>(null);
  const [coverAsset, setCoverAsset] = useState<ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    weight: String(user?.weight || ''),
    height: String(user?.height || ''),
  });
  const usernameRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);
  const weightRef = useRef<TextInput>(null);
  const heightRef = useRef<TextInput>(null);
  // Location is not part of this form. It is chosen from the dataset on its own
  // screen and written by the backend, so it is only shown here as a link.
  const locationLabel = user?.location || '';

  const profilePreview = profileAsset?.uri || user?.profile_picture || '';
  const coverPreview = coverAsset?.uri || user?.cover_photo || '';

  const updateField = (field: keyof typeof form) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const pickImage = async (kind: 'profile' | 'cover') => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showError(
          t('profile.photo_permission_title', 'Photo permission required'),
          t('profile.photo_permission_body', 'Allow photo access to update your profile images.'),
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: kind === 'profile' ? [1, 1] : [16, 9],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      validateAsset(asset);
      if (kind === 'profile') setProfileAsset(asset);
      else setCoverAsset(asset);
    } catch (error) {
      showError(t('common.error', 'Error'), getUserFacingError(error));
    }
  };

  const saveProfile = async () => {
    if (!form.full_name.trim() || !form.username.trim()) {
      showError(
        t('common.error', 'Error'),
        t('profile.required_fields', 'Full name and username are required.'),
      );
      return;
    }

    setSaving(true);
    try {
      if (profileAsset) validateAsset(profileAsset);
      if (coverAsset) validateAsset(coverAsset);
      const token = await getToken();
      if (!token) throw new Error(t('auth.session_expired', 'Your session has expired.'));

      const [uploadedProfileKey, uploadedCoverKey] = await Promise.all([
        profileAsset ? uploadMedia(profileAsset, 'profiles', token) : null,
        coverAsset ? uploadMedia(coverAsset, 'covers', token) : null,
      ]);
      const payload = {
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        bio: form.bio.trim(),
        weight: form.weight.trim().replace(',', '.') || 0,
        height: form.height.trim().replace(',', '.') || 0,
        ...(uploadedProfileKey ? { uploadedProfileKey } : {}),
        ...(uploadedCoverKey ? { uploadedCoverKey } : {}),
      };

      await dispatch(updateUser({ userData: payload, token })).unwrap();
      showSuccess(
        t('profile.updated_title', 'Profile updated'),
        t('profile.updated_body', 'Your changes are now visible.'),
      );
      navigation.goBack();
    } catch (error) {
      logHandledError('update-profile', error);
      showError(
        t('common.error', 'Error'),
        typeof error === 'string'
          ? error
          : getUserFacingError(error, t('profile.update_failed', 'Profile update failed.')),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={t('profile.edit_profile', 'Edit profile')}
        backIcon="close"
        onBack={saving ? undefined : () => navigation.goBack()}
        scrolled={headerEdge.scrolled}
        textAction={{ label: t('common.save', 'Kaydet'), onPress: () => void saveProfile(), busy: saving }}
      />

      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        onScroll={headerEdge.onScroll}
        scrollEventThrottle={headerEdge.scrollEventThrottle}
        contentContainerStyle={styles.content}
        extraScrollHeight={24}
      >
        {/* The picture first, centred, with one text link under it - the only
            thing on the screen that is not a line of the form. */}
        <View style={styles.photo}>
          <Pressable
            onPress={() => void pickImage('profile')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.change_photo', 'Change profile photo')}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            {profilePreview ? (
              <Image source={{ uri: profilePreview }} style={[styles.avatar, { backgroundColor: theme.surfaceLight }]} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: theme.surfaceLight }]}>
                <Text style={{ color: theme.textSecondary, fontSize: 32, fontWeight: '500' }}>
                  {form.full_name.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => void pickImage('profile')} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.photoLink, { color: theme.primary }]}>
              {t('profile.change_photo', 'Change profile photo')}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.form, { borderTopColor: theme.border }]}>
          <FieldRow
            label={t('profile.full_name', 'Full name')}
            value={form.full_name}
            onChangeText={updateField('full_name')}
            maxLength={100}
            textContentType="name"
            autoComplete="name"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => usernameRef.current?.focus()}
          />
          <FieldRow
            label={t('profile.username', 'Username')}
            inputRef={usernameRef}
            value={form.username}
            onChangeText={updateField('username')}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            textContentType="username"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => bioRef.current?.focus()}
          />
          <FieldRow
            label={t('profile.bio', 'Bio')}
            inputRef={bioRef}
            value={form.bio}
            onChangeText={updateField('bio')}
            placeholder={t('profile.bio_placeholder', 'Kendinden kısaca bahset')}
            multiline
            maxLength={500}
          />

          {/* A validated place from the world city list, not free text: the
              label on a profile is rendered by the backend from the record
              the member picked. */}
          <Pressable
            onPress={() => navigation.navigate('LocationPickerScreen', { source: 'profile_update' })}
            disabled={saving}
            accessibilityRole="button"
            style={({ pressed }) => [styles.fieldRow, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.fieldLabel, { color: theme.text }]} numberOfLines={1}>
              {t('profile.location', 'Location')}
            </Text>
            <View style={[styles.fieldValue, styles.linkValue, { borderBottomColor: theme.border }]}>
              <Text numberOfLines={1} style={[styles.input, { flex: 1, color: locationLabel ? theme.text : theme.textMuted }]}>
                {locationLabel || t('location.not_set', 'Not set')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </View>
          </Pressable>

          <FieldRow
            label={t('profile.weight', 'Weight (kg)')}
            inputRef={weightRef}
            value={form.weight}
            onChangeText={updateField('weight')}
            keyboardType="decimal-pad"
            placeholder="–"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => heightRef.current?.focus()}
          />
          <FieldRow
            label={t('profile.height', 'Height (cm)')}
            inputRef={heightRef}
            value={form.height}
            onChangeText={updateField('height')}
            keyboardType="decimal-pad"
            placeholder="–"
            returnKeyType="done"
            onSubmitEditing={() => void saveProfile()}
          />
        </View>

        {/* The cover is optional and secondary, so it is a row, not a banner
            that takes the top of the screen. */}
        <Pressable
          onPress={() => void pickImage('cover')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.coverRow, { borderColor: theme.border }, pressed && { backgroundColor: theme.surfaceLight }]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.coverTitle, { color: theme.text }]}>{t('profile.cover_photo', 'Kapak fotoğrafı')}</Text>
            <Text style={[styles.coverHint, { color: theme.textMuted }]} numberOfLines={1}>
              {coverPreview ? t('profile.change_cover', 'Change cover') : t('profile.add_cover', 'Add cover photo')}
            </Text>
          </View>
          {coverPreview ? (
            <Image source={{ uri: coverPreview }} style={[styles.coverThumb, { backgroundColor: theme.surfaceLight }]} resizeMode="cover" />
          ) : (
            <Ionicons name="image-outline" size={20} color={theme.textMuted} />
          )}
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: 40 },
  photo: { alignItems: 'center', paddingTop: 12, paddingBottom: 16, gap: 10 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  photoLink: { fontSize: TYPE.button, fontWeight: '600' },
  form: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 16, minHeight: 48 },
  fieldLabel: { width: LABEL_WIDTH, fontSize: TYPE.body, paddingTop: 14 },
  fieldValue: { flex: 1, minWidth: 0, marginRight: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  linkValue: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 6 },
  input: { fontSize: TYPE.body + 0.5, paddingVertical: 13, paddingHorizontal: 0 },
  multiline: { minHeight: 64, maxHeight: 140, paddingTop: 13 },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  coverTitle: { fontSize: TYPE.body, fontWeight: '500' },
  coverHint: { fontSize: TYPE.meta, marginTop: 2 },
  coverThumb: { width: 64, height: 36, borderRadius: 6 },
});

export default ProfileEditScreen;
