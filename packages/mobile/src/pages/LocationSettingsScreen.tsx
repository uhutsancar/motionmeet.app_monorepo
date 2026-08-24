import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Alert, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Divider, Surface, Switch, Text, TouchableRipple } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type {
  DistanceVisibility,
  NearbySettings,
  ProfileLocation,
  ProfileLocationVisibility,
} from '@motionmeet/shared';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import {
  clearProfileLocation,
  deleteNearbyPosition,
  getNearbySettings,
  getProfileLocation,
  setProfileLocationVisibility,
  updateNearbySettings,
} from '../api/endpoints';
import { fetchUser } from '../features/user/userSlice';
import { useAppDispatch } from '../store/hooks';
import { getUserFacingError, showError, showSuccess } from '../utils/feedback';
import ScreenHeader from '../components/ScreenHeader';
import type { NavigationOnlyProps } from '../navigation/types';

/**
 * One place to see and undo everything MotionMeet knows about where a member is.
 *
 * The two halves stay visually separate because they are separate: the profile
 * location is a public label the member chose, the nearby position is a private
 * fix that only ever leaves the server as a distance band. Each half has its
 * own visibility control and its own delete button, and neither affects the
 * other.
 */

// Declared at module scope rather than inside the screen: a component defined in
// a render body is a new type on every render, so React unmounts and remounts
// its whole subtree instead of updating it.
const Section = ({ theme, title, children }: React.PropsWithChildren<{ theme: MotionTheme; title: string }>) => (
  <View style={{ gap: 9 }}>
    <Text style={{ color: theme.textMuted, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1, marginLeft: 4 }}>
      {title.toUpperCase()}
    </Text>
    <Surface elevation={0} style={{ overflow: 'hidden', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, backgroundColor: theme.surface }}>
      {children}
    </Surface>
  </View>
);

interface ChoiceRowProps<T extends string> {
  theme: MotionTheme;
  disabled: boolean;
  label: string;
  description?: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (value: T) => void;
}

const ChoiceRow = <T extends string>({ theme, disabled, label, description, options, value, onChange }: ChoiceRowProps<T>) => (
  <View style={{ paddingHorizontal: 14, paddingVertical: 13, gap: 9 }}>
    <View>
      <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '800' }}>{label}</Text>
      {description ? <Text style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 2, lineHeight: 16 }}>{description}</Text> : null}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableRipple
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            style={{
              paddingHorizontal: 12, height: 33, justifyContent: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
              borderColor: active ? theme.primary : theme.border,
              backgroundColor: active ? theme.primarySoft : 'transparent',
            }}
          >
            <Text style={{ color: active ? theme.primary : theme.textSecondary, fontSize: 11.5, fontWeight: '800' }}>{option.label}</Text>
          </TouchableRipple>
        );
      })}
    </View>
  </View>
);

interface ActionRowProps {
  theme: MotionTheme;
  disabled: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  title: string;
  description?: string;
  onPress: () => void;
}

const ActionRow = ({ theme, disabled, icon, color, title, description, onPress }: ActionRowProps) => (
  <TouchableRipple onPress={onPress} disabled={disabled}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 13 }}>
      <View style={{ width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: `${color}18` }}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '800' }}>{title}</Text>
        {description ? <Text numberOfLines={2} style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 2 }}>{description}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </View>
  </TouchableRipple>
);

const LocationSettingsScreen = ({ navigation }: NavigationOnlyProps) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { getToken } = useAuthContext();
  const dispatch = useAppDispatch();
  const { horizontalPadding } = useResponsiveLayout();
  const { openSettings } = useDeviceLocation();

  const [profile, setProfile] = useState<ProfileLocation | null>(null);
  const [nearby, setNearby] = useState<NearbySettings | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [profileResponse, nearbyResponse] = await Promise.all([getProfileLocation(token), getNearbySettings(token)]);
      if (profileResponse.success) setProfile(profileResponse.location);
      if (nearbyResponse.success) setNearby(nearbyResponse.settings);
    } catch (error) {
      showError(t('common.error', 'Error'), getUserFacingError(error));
    }
  }, [getToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const guarded = useCallback(async (work: (token: string) => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      await work(token);
    } catch (error) {
      showError(t('common.error', 'Error'), getUserFacingError(error));
    } finally {
      setBusy(false);
    }
  }, [busy, getToken, t]);

  const changeProfileVisibility = (visibility: ProfileLocationVisibility) => void guarded(async (token) => {
    const response = await setProfileLocationVisibility(visibility, token);
    if (response.success) setProfile(response.location);
  });

  const removeProfileLocation = () => Alert.alert(
    t('location.remove_title', 'Remove profile location?'),
    t('location.remove_body', 'Your profile will no longer show a place. Nearby is not affected.'),
    [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('common.remove', 'Remove'),
        style: 'destructive',
        onPress: () => void guarded(async (token) => {
          const response = await clearProfileLocation(token);
          if (response.success) setProfile(response.location);
          await dispatch(fetchUser(token));
          showSuccess(t('location.removed_title', 'Location removed'), t('location.removed_body', 'Your profile no longer shows a place.'));
        }),
      },
    ],
  );

  const changeNearby = (patch: { visible?: boolean; distanceVisibility?: DistanceVisibility }) => void guarded(async (token) => {
    const response = await updateNearbySettings(patch, token);
    if (response.success) setNearby(response.settings);
  });

  const deleteStoredPosition = () => Alert.alert(
    t('nearby.delete_title', 'Delete stored location?'),
    t('nearby.delete_body', 'Your saved position and nearby preferences are erased and the feature is switched off. Your profile location is not affected.'),
    [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('common.delete', 'Delete'),
        style: 'destructive',
        onPress: () => void guarded(async (token) => {
          const response = await deleteNearbyPosition(token);
          if (response.success) setNearby(response.settings);
          showSuccess(t('nearby.deleted_title', 'Location deleted'), t('nearby.deleted_body', 'Nothing about your position is stored any more.'));
        }),
      },
    ],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader title={t('location.settings_title', 'Location')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: horizontalPadding, paddingTop: 14, paddingBottom: 34, gap: 20 }}
      >
        <Text style={{ color: theme.textSecondary, fontSize: 12.5, lineHeight: 18 }}>
          {t('location.settings_intro', 'MotionMeet keeps two things apart: the place you chose to show on your profile, and the position used to find athletes near you. They are stored separately and you control each one on its own.')}
        </Text>

        <Section theme={theme} title={t('location.profile_section', 'Profile location')}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 13 }}>
            <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700' }}>
              {t('location.current_value', 'Shown on your profile')}
            </Text>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800', marginTop: 4 }}>
              {profile?.displayName || t('location.not_set', 'Not set')}
            </Text>
          </View>
          <Divider />
          <ActionRow
            theme={theme}
            disabled={busy}
            icon="search-outline"
            color={theme.primary}
            title={profile?.displayName ? t('location.change', 'Change location') : t('location.add', 'Add location')}
            description={t('location.change_hint', 'Pick from the world city list')}
            onPress={() => navigation.navigate('LocationPickerScreen', { source: 'profile_update' })}
          />
          <Divider />
          <ChoiceRow<ProfileLocationVisibility>
            theme={theme}
            disabled={busy}
            label={t('location.visibility', 'Who can see it')}
            description={t('location.visibility_hint', 'Applies to your profile, search results and suggestions.')}
            value={profile?.visibility}
            onChange={changeProfileVisibility}
            options={[
              { value: 'public', label: t('location.visibility_public', 'Everyone') },
              { value: 'followers', label: t('location.visibility_followers', 'Followers') },
              { value: 'connections', label: t('location.visibility_connections', 'Connections') },
              { value: 'private', label: t('location.visibility_private', 'Only me') },
            ]}
          />
          {profile?.displayName ? (
            <>
              <Divider />
              <ActionRow
                theme={theme}
                disabled={busy}
                icon="trash-outline"
                color={theme.danger}
                title={t('location.remove', 'Remove profile location')}
                onPress={removeProfileLocation}
              />
            </>
          ) : null}
        </Section>

        <Section theme={theme} title={t('nearby.section', 'Nearby')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '800' }}>{t('nearby.visible', 'Appear in nearby results')}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 2, lineHeight: 16 }}>
                {t('nearby.visible_hint', 'Turn this off to keep browsing without being listed by others.')}
              </Text>
            </View>
            <Switch
              value={nearby?.visible ?? true}
              onValueChange={(visible) => changeNearby({ visible })}
              disabled={busy || !nearby}
              color={theme.primary}
            />
          </View>
          <Divider />
          <ChoiceRow<DistanceVisibility>
            theme={theme}
            disabled={busy}
            label={t('nearby.distance_visibility', 'How much distance to show')}
            description={t('nearby.distance_visibility_hint', 'Distances are always ranges. An exact figure is never shown to anyone.')}
            value={nearby?.distanceVisibility}
            onChange={(distanceVisibility) => changeNearby({ distanceVisibility })}
            options={[
              { value: 'approximate', label: t('nearby.distance_approximate', 'Range') },
              { value: 'nearby_only', label: t('nearby.distance_nearby_only', 'Only "nearby"') },
              { value: 'hidden', label: t('nearby.distance_hidden', 'Nothing') },
            ]}
          />
          <Divider />
          <ActionRow
            theme={theme}
            disabled={busy}
            icon="trash-outline"
            color={theme.danger}
            title={t('nearby.delete', 'Delete my stored location')}
            description={nearby?.locationUpdatedAt
              ? t('nearby.delete_hint', 'Erases the saved position and switches the feature off.')
              : t('nearby.delete_none', 'Nothing is stored right now.')}
            onPress={deleteStoredPosition}
          />
        </Section>

        <Section theme={theme} title={t('location.device_section', 'Device')}>
          <ActionRow
            theme={theme}
            disabled={busy}
            icon="settings-outline"
            color={theme.secondary}
            title={t('nearby.open_settings', 'Open Settings')}
            description={t('location.device_hint', 'Change the location permission for MotionMeet in your system settings.')}
            onPress={() => void openSettings()}
          />
        </Section>

        <Text style={{ color: theme.textMuted, fontSize: 10.5, lineHeight: 16, textAlign: 'center', paddingHorizontal: 8 }}>
          {t('location.privacy_footer', 'MotionMeet reads your position only while the Nearby screen is open, never in the background, and keeps no history of where you have been. Place data by Countries States Cities Database · ODbL v1.0.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LocationSettingsScreen;
