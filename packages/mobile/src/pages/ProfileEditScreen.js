import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';
import { uploadMedia } from '../api/mediaUpload';
import { updateUser } from '../features/user/userSlice';

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

const validateAsset = (asset) => {
  if (!asset?.uri) throw new Error('Please select a valid image.');
  if (asset.mimeType && !ALLOWED_IMAGE_TYPES.has(asset.mimeType.toLowerCase())) {
    throw new Error('Use a JPG, PNG, WebP, GIF, HEIC or HEIF image.');
  }
  if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
    throw new Error('Profile images must be smaller than 5 MB.');
  }
};

const ProfileEditScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.value);
  const { getToken } = useAuthContext();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [profileAsset, setProfileAsset] = useState(null);
  const [coverAsset, setCoverAsset] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    bio: user?.bio || user?.biography || '',
    location: user?.location || '',
    weight: String(user?.weight || ''),
    height: String(user?.height || ''),
  });

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

  const updateField = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const pickImage = async (kind) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
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
      Alert.alert(t('common.error', 'Error'), error.message);
    }
  };

  const saveProfile = async () => {
    if (!form.full_name.trim() || !form.username.trim()) {
      Alert.alert(
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
        location: form.location.trim(),
        weight: form.weight.trim() || 0,
        height: form.height.trim() || 0,
        ...(uploadedProfileKey ? { uploadedProfileKey } : {}),
        ...(uploadedCoverKey ? { uploadedCoverKey } : {}),
      };

      await dispatch(updateUser({ userData: payload, token })).unwrap();
      Alert.alert(
        t('profile.updated_title', 'Profile updated'),
        t('profile.updated_body', 'Your changes are now visible.'),
        [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert(
        t('common.error', 'Error'),
        typeof error === 'string' ? error : error.message || t('profile.update_failed', 'Profile update failed.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} disabled={saving} />
        <Appbar.Content
          title={t('profile.edit_profile', 'Edit profile')}
          titleStyle={{ color: theme.text, fontWeight: '800', fontSize: 20 }}
        />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            padding: 16,
            paddingBottom: 40,
            gap: 16,
          }}
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
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: theme.overlay,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
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
              <Text style={{ marginTop: 8, color: theme.primary, fontSize: 12, fontWeight: '800' }}>
                {t('profile.change_photo', 'Change profile photo')}
              </Text>
              <Text style={{ marginTop: 3, color: theme.textMuted, fontSize: 10.5 }}>
                {t('profile.photo_requirements', 'JPG, PNG, WebP, GIF, HEIC · max 5 MB')}
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
            <TextInput
              mode="outlined"
              label={t('profile.location', 'Location')}
              value={form.location}
              onChangeText={updateField('location')}
              maxLength={100}
              theme={inputTheme}
              textColor={theme.text}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ProfileEditScreen;
