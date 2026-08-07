import React, { useMemo, useState } from 'react';
import {
  Image,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import {
  Appbar,
  Avatar,
  Button,
  Surface,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { uploadMedia } from '../api/mediaUpload';
import { updateUser } from '../features/user/userSlice';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import {
  getUserFacingError,
  logHandledError,
  showError,
  showSuccess,
} from '../utils/feedback';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useAppDispatch, useAppSelector } from '../store/hooks';
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

const validateAsset = (asset: ImagePickerAsset): void => {
  if (!asset?.uri) throw new Error('Please select a valid image.');
  if (asset.mimeType && !ALLOWED_IMAGE_TYPES.has(asset.mimeType.toLowerCase())) {
    throw new Error('Use a JPG, PNG, WebP, GIF, HEIC or HEIF image.');
  }
  if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
    throw new Error('Profile images must be smaller than 5 MB.');
  }
};

const ProfileEditScreen = ({ navigation }: NavigationOnlyProps) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.value);
  const { getToken } = useAuthContext();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { horizontalPadding, isNarrow } = useResponsiveLayout();
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
  // Location is not part of this form. It is chosen from the dataset on its own
  // screen and written by the backend, so it is only shown here as a link.
  const locationLabel = user?.location || '';

  const profilePreview = profileAsset?.uri || user?.profile_picture || '';
  const coverPreview = coverAsset?.uri || user?.cover_photo || '';
  const inputTheme = useMemo(
    () => ({
      colors: {
        primary: theme.primary,
        background: theme.surfaceLight,
        onSurfaceVariant: theme.textMuted,
      },
    }),
    [theme],
  );

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
        weight: form.weight.trim() || 0,
        height: form.height.trim() || 0,
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right', 'bottom']}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} disabled={saving} />
        <Appbar.Content
          title={t('profile.edit_profile', 'Edit profile')}
          titleStyle={{ color: theme.text, fontWeight: '800', fontSize: 20 }}
        />
      </Appbar.Header>

        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            paddingHorizontal: horizontalPadding,
            paddingTop: 16,
            paddingBottom: 40,
            gap: 16,
          }}
          extraScrollHeight={28}
        >
          <Surface
            elevation={0}
            style={{
              overflow: 'hidden',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <TouchableRipple onPress={() => pickImage('cover')}>
              <View style={{ height: 150, backgroundColor: theme.primarySoft }}>
                {coverPreview ? (
                  <Image source={{ uri: coverPreview }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: theme.textMuted, fontWeight: '700' }}>
                      {t('profile.add_cover', 'Add cover photo')}
                    </Text>
                  </View>
                )}
                <View
                  style={{
                    position: 'absolute',
                    right: 12,
                    bottom: 12,
                    maxWidth: '76%',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: theme.overlay,
                  }}
                >
                  <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                    {t('profile.change_cover', 'Change cover')}
                  </Text>
                </View>
              </View>
            </TouchableRipple>

            <View style={{ alignItems: 'center', marginTop: -44, paddingBottom: 18 }}>
              <TouchableRipple
                borderless
                onPress={() => pickImage('profile')}
                style={{ borderRadius: 50 }}
              >
                {profilePreview ? (
                  <Avatar.Image
                    source={{ uri: profilePreview }}
                    size={92}
                    style={{ backgroundColor: theme.surface, borderWidth: 4, borderColor: theme.surface }}
                  />
                ) : (
                  <Avatar.Text
                    label={form.full_name.charAt(0).toUpperCase() || 'U'}
                    size={92}
                    style={{ backgroundColor: theme.primary, borderWidth: 4, borderColor: theme.surface }}
                  />
                )}
              </TouchableRipple>
              {/* The accepted formats and size limit are enforced on upload and
                  surfaced as an error there, so the form stays uncluttered. */}
              <Text style={{ marginTop: 8, color: theme.primary, fontSize: 12, fontWeight: '800' }}>
                {t('profile.change_photo', 'Change profile photo')}
              </Text>
            </View>
          </Surface>

          <Surface
            elevation={0}
            style={{
              padding: 16,
              gap: 13,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <TextInput
              mode="outlined"
              label={t('profile.full_name', 'Full name')}
              value={form.full_name}
              onChangeText={updateField('full_name')}
              maxLength={100}
              theme={inputTheme}
              textColor={theme.text}
            />
            <TextInput
              mode="outlined"
              label={t('profile.username', 'Username')}
              value={form.username}
              onChangeText={updateField('username')}
              autoCapitalize="none"
              maxLength={30}
              theme={inputTheme}
              textColor={theme.text}
            />
            <TextInput
              mode="outlined"
              label={t('profile.bio', 'Bio')}
              value={form.bio}
              onChangeText={updateField('bio')}
              multiline
              numberOfLines={4}
              maxLength={500}
              theme={inputTheme}
              textColor={theme.text}
            />
            {/* A validated place from the world city list, not free text: the
                label on a profile is rendered by the backend from the record
                the member picked. */}
            <TouchableRipple
              onPress={() => navigation.navigate('LocationPickerScreen', { source: 'profile_update' })}
              disabled={saving}
              style={{ borderRadius: 4 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  minHeight: 56,
                  paddingHorizontal: 14,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceLight,
                }}
              >
                <Ionicons name="location-outline" size={19} color={theme.textMuted} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: theme.textMuted, fontSize: 11 }}>{t('profile.location', 'Location')}</Text>
                  <Text numberOfLines={1} style={{ color: locationLabel ? theme.text : theme.textMuted, fontSize: 14.5, marginTop: 1 }}>
                    {locationLabel || t('location.not_set', 'Not set')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
              </View>
            </TouchableRipple>
            <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 12 }}>
              <TextInput
                mode="outlined"
                label={t('profile.weight', 'Weight (kg)')}
                value={form.weight}
                onChangeText={updateField('weight')}
                keyboardType="decimal-pad"
                style={{ flex: 1 }}
                theme={inputTheme}
                textColor={theme.text}
              />
              <TextInput
                mode="outlined"
                label={t('profile.height', 'Height (cm)')}
                value={form.height}
                onChangeText={updateField('height')}
                keyboardType="decimal-pad"
                style={{ flex: 1 }}
                theme={inputTheme}
                textColor={theme.text}
              />
            </View>
          </Surface>

          <Button
            mode="contained"
            onPress={saveProfile}
            loading={saving}
            disabled={saving}
            buttonColor={theme.primary}
            textColor="#FFFFFF"
            style={{ borderRadius: 12 }}
            contentStyle={{ minHeight: 52 }}
            labelStyle={{ fontSize: 15, fontWeight: '900' }}
          >
            {saving ? t('common.saving', 'Saving...') : t('profile.save_changes', 'Save changes')}
          </Button>
        </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default ProfileEditScreen;
