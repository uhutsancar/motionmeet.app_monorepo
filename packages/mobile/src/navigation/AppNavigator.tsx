import React, { useCallback, useEffect } from 'react';

import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import { useAppSelector } from '../store/hooks';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from '@motionmeet/shared';

import Feed from '../pages/Feed';
import Explore from '../pages/Explore';
import Routines from '../pages/Routines';
import Exercises from '../pages/Exercises';
import Profile from '../pages/Profile';
import Messages from '../pages/Messages';
/*
 * React Navigation's `getComponent` wants a screen resolved synchronously on
 * first navigation, which is what keeps these off the initial bundle evaluation.
 * `import()` returns a promise and cannot be used here, so the rule is off for
 * this block rather than for the file.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const loadSettings = () => require('../pages/Settings').default;
const loadProfileEdit = () => require('../pages/ProfileEditScreen').default;
const loadChatBox = () => require('../pages/ChatBox').default;
const loadStatistics = () => require('../pages/Statistics').default;
const loadConnections = () => require('../pages/Connections').default;
const loadMeasurements = () => require('../pages/MeasurementsScreen').default;
const loadMeasurementEntry = () => require('../pages/MeasurementEntryScreen').default;
const loadExerciseDetail = () => require('../pages/ExerciseDetail').default;
const loadMuscleDistribution = () => require('../pages/MuscleDistribution').default;
const loadWorkoutSummary = () => require('../pages/WorkoutSummaryScreen').default;
const loadWorkoutDetail = () => require('../pages/WorkoutDetailScreen').default;
const loadActiveWorkout = () => require('../pages/ActiveWorkoutScreen').default;
const loadMonthlyReport = () => require('../pages/MonthlyReportScreen').default;
const loadWorkoutsDetail = () => require('../pages/WorkoutsDetailScreen').default;
const loadDurationDetail = () => require('../pages/DurationDetailScreen').default;
const loadVolumeDetail = () => require('../pages/VolumeDetailScreen').default;
const loadSetsDetail = () => require('../pages/SetsDetailScreen').default;
// Two distinct screens: `ActivityScreen` is the bell's list of what happened,
// `NotificationsScreen` is the preference toggles under Settings.
const loadActivity = () => require('../pages/ActivityScreen').default;
const loadNotifications = () => require('../pages/NotificationsScreen').default;
const loadPrivacy = () => require('../pages/PrivacyScreen').default;
const loadSupport = () => require('../pages/SupportScreen').default;
const loadPricing = () => require('../pages/PricingScreen').default;
const loadAdvancedStatistics = () => require('../pages/AdvancedStatisticsScreen').default;
const loadMuscleDistributionBody = () => require('../pages/MuscleDistributionBodyScreen').default;
const loadMainExercises = () => require('../pages/MainExercisesScreen').default;
const loadLeaderboard = () => require('../pages/LeaderboardScreen').default;
const loadLocationPicker = () => require('../pages/LocationPickerScreen').default;
const loadLocationSettings = () => require('../pages/LocationSettingsScreen').default;
const loadNearby = () => require('../pages/NearbyScreen').default;
const loadLicenses = () => require('../pages/LicensesScreen').default;
/* eslint-enable @typescript-eslint/no-require-imports */

const Tab = createMaterialTopTabNavigator();
const Stack = createNativeStackNavigator();

/* ─── Profile Stack ──────────────────────────────────────────────────────────── */
const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={Profile} />
    <Stack.Screen name="ProfileEdit" getComponent={loadProfileEdit} />
    <Stack.Screen name="Settings" getComponent={loadSettings} />
    <Stack.Screen name="Statistics" getComponent={loadStatistics} />
    <Stack.Screen name="AdvancedStatisticsScreen" getComponent={loadAdvancedStatistics} />
    <Stack.Screen name="MuscleDistribution" getComponent={loadMuscleDistribution} />
    <Stack.Screen name="MuscleDistributionBodyScreen" getComponent={loadMuscleDistributionBody} />
    <Stack.Screen name="MainExercisesScreen" getComponent={loadMainExercises} />
    <Stack.Screen name="LeaderboardScreen" getComponent={loadLeaderboard} />
    <Stack.Screen name="MonthlyReportScreen" getComponent={loadMonthlyReport} />
    <Stack.Screen name="WorkoutsDetailScreen" getComponent={loadWorkoutsDetail} />
    <Stack.Screen name="DurationDetailScreen" getComponent={loadDurationDetail} />
    <Stack.Screen name="VolumeDetailScreen" getComponent={loadVolumeDetail} />
    <Stack.Screen name="SetsDetailScreen" getComponent={loadSetsDetail} />
    <Stack.Screen name="Connections" getComponent={loadConnections} />
    <Stack.Screen name="MeasurementsScreen" getComponent={loadMeasurements} />
    <Stack.Screen name="MeasurementEntryScreen" getComponent={loadMeasurementEntry} />
    <Stack.Screen name="LocationPickerScreen" getComponent={loadLocationPicker} />
    <Stack.Screen name="LocationSettingsScreen" getComponent={loadLocationSettings} />
    <Stack.Screen name="NearbyScreen" getComponent={loadNearby} />
    <Stack.Screen name="LicensesScreen" getComponent={loadLicenses} />
    <Stack.Screen name="ActivityScreen" getComponent={loadActivity} />
    <Stack.Screen name="NotificationsScreen" getComponent={loadNotifications} />
  </Stack.Navigator>
);

/* ─── Main Stack (wraps tabs + allows extra modals) ─────────────────────────── */
const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabs" component={TabNavigator} />
    <Stack.Screen name="Profile" component={Profile} />
    {/* Messages left the tab bar: it is opened from the feed header now, the
        same place the activity bell lives. */}
    <Stack.Screen name="Messages" component={Messages} />
    <Stack.Screen name="ProfileEdit" getComponent={loadProfileEdit} />
    <Stack.Screen name="Settings" getComponent={loadSettings} />
    <Stack.Screen name="Statistics" getComponent={loadStatistics} />
    <Stack.Screen name="ChatBox" getComponent={loadChatBox} />
    <Stack.Screen name="Connections" getComponent={loadConnections} />
    <Stack.Screen name="MeasurementsScreen" getComponent={loadMeasurements} />
    <Stack.Screen name="MeasurementEntryScreen" getComponent={loadMeasurementEntry} />
    <Stack.Screen name="ExerciseDetail" getComponent={loadExerciseDetail} />
    <Stack.Screen name="MuscleDistribution" getComponent={loadMuscleDistribution} />
    <Stack.Screen name="WorkoutSummaryScreen" getComponent={loadWorkoutSummary} />
    <Stack.Screen name="WorkoutDetailScreen" getComponent={loadWorkoutDetail} />
    <Stack.Screen name="ActiveWorkoutScreen" getComponent={loadActiveWorkout} />
    <Stack.Screen name="MonthlyReportScreen" getComponent={loadMonthlyReport} />
    <Stack.Screen name="WorkoutsDetailScreen" getComponent={loadWorkoutsDetail} />
    <Stack.Screen name="DurationDetailScreen" getComponent={loadDurationDetail} />
    <Stack.Screen name="VolumeDetailScreen" getComponent={loadVolumeDetail} />
    <Stack.Screen name="SetsDetailScreen" getComponent={loadSetsDetail} />
    <Stack.Screen name="PrivacyScreen" getComponent={loadPrivacy} />
    <Stack.Screen name="SupportScreen" getComponent={loadSupport} />
    <Stack.Screen name="PricingScreen" getComponent={loadPricing} />
    <Stack.Screen name="AdvancedStatisticsScreen" getComponent={loadAdvancedStatistics} />
    <Stack.Screen name="MuscleDistributionBodyScreen" getComponent={loadMuscleDistributionBody} />
    <Stack.Screen name="MainExercisesScreen" getComponent={loadMainExercises} />
    <Stack.Screen name="LeaderboardScreen" getComponent={loadLeaderboard} />
    <Stack.Screen name="LocationPickerScreen" getComponent={loadLocationPicker} />
    <Stack.Screen name="LocationSettingsScreen" getComponent={loadLocationSettings} />
    <Stack.Screen name="NearbyScreen" getComponent={loadNearby} />
    <Stack.Screen name="LicensesScreen" getComponent={loadLicenses} />
    <Stack.Screen name="ActivityScreen" getComponent={loadActivity} />
    <Stack.Screen name="NotificationsScreen" getComponent={loadNotifications} />
  </Stack.Navigator>
);

/* ─── Tab Navigator ──────────────────────────────────────────────────────────── */
/**
 * The five places the app opens into.
 *
 * Messages used to sit here; it moved next to the activity bell in the feed
 * header, and Keşfet took its place so browsing the community is one tap from
 * anywhere rather than an option inside a menu.
 */
const TABS = [
  { name: 'Home', icon: 'home' },
  { name: 'ExploreTab', icon: 'search' },
  { name: 'Routines', icon: 'fitness' },
  { name: 'Exercises', icon: 'barbell' },
  { name: 'ProfileTab', icon: 'person' },
] as const;

const TabNavigator = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const profilePicture = useAppSelector((state) => state.user.value?.profile_picture);

  // Fixed height so the pill indicator never jumps; only the safe-area padding
  // below the row changes from device to device.
  const barHeight = fontScale > 1.4 ? 66 : 60;

  // A new message still raises a toast from anywhere in the app. The unread
  // count itself belongs to the feed header now, which is where it is shown.
  useEffect(() => {
    if (!socket) return;
    const onMessage = async (message: Message) => {
      try {
        const stored = await AsyncStorage.getItem('@mm_notification_prefs');
        const preferences: { newMessage?: boolean } = stored ? JSON.parse(stored) : {};
        if (preferences.newMessage === false) return;
      } catch {
        // Invalid preferences fall back to enabled.
      }
      Toast.show({
        type: 'info',
        text1:
          (typeof message.from_user_id === 'object' ? message.from_user_id.full_name : '') ||
          t('notifications.new_message', 'Yeni Mesaj'),
        text2: message?.text || t('notifications.you_have_message', 'Size yeni bir mesaj geldi.'),
        position: 'top',
        topOffset: 60,
        visibilityTime: 4000,
      });
    };
    socket.on('message_received', onMessage);
    return () => {
      socket.off('message_received', onMessage);
    };
  }, [socket, t]);

  const renderTabBar = useCallback(
    (props: MaterialTopTabBarProps) => {
      const { state, descriptors, navigation } = props;
      return (
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 8),
            // A lifted edge rather than a hard seam against the content above.
            shadowColor: theme.shadow,
            shadowOpacity: 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: -4 },
            elevation: 14,
          }}
        >
          <View style={{ flexDirection: 'row', height: barHeight, alignItems: 'center' }}>
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const { options } = descriptors[route.key];
              const label =
                typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
              const base = TABS.find((entry) => entry.name === route.name)?.icon ?? 'ellipse';
              const iconName = (focused
                ? base
                : base + '-outline') as React.ComponentProps<typeof Ionicons>['name'];
              const isProfile = route.name === 'ProfileTab';
              const avatar = typeof profilePicture === 'string' ? profilePicture.trim() : '';

              return (
                <Pressable
                  key={route.key}
                  onPress={() => {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={label}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View
                    style={{
                      minWidth: 54,
                      height: 34,
                      paddingHorizontal: 14,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: focused ? theme.primarySoft : 'transparent',
                    }}
                  >
                    {isProfile && avatar ? (
                      <Image
                        source={{ uri: avatar }}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: focused ? 2 : 0,
                          borderColor: theme.primary,
                        }}
                      />
                    ) : (
                      <Ionicons
                        name={iconName}
                        size={route.name === 'Exercises' ? 24 : 22}
                        color={focused ? theme.primary : theme.textMuted}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    },
    [barHeight, insets.bottom, profilePicture, theme],
  );

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      tabBarPosition="bottom"
      // Screens stay mounted while swiping so the pager is smooth, but only the
      // ones that have been visited are built.
      screenOptions={{ lazy: true, swipeEnabled: true }}
    >
      <Tab.Screen name="Home" component={Feed} options={{ tabBarLabel: t('tabs.home', 'Ana Sayfa') }} />
      <Tab.Screen
        name="ExploreTab"
        component={Explore}
        options={{ tabBarLabel: t('tabs.explore', 'Keşfet') }}
      />
      <Tab.Screen
        name="Routines"
        component={Routines}
        options={{ tabBarLabel: t('tabs.routines', 'Antrenman') }}
      />
      <Tab.Screen
        name="Exercises"
        component={Exercises}
        options={{ tabBarLabel: t('tabs.exercises', 'Egzersizler') }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{ tabBarLabel: t('tabs.profile', 'Profil') }}
      />
    </Tab.Navigator>
  );
};

/* ─── Root ───────────────────────────────────────────────────────────────────── */
const AppNavigator = () => {
  const { theme, isDark } = useTheme();
  const navigationBaseTheme = isDark ? NavigationDarkTheme : NavigationLightTheme;
  const navigationTheme = {
    ...navigationBaseTheme,
    colors: {
      ...navigationBaseTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      notification: theme.colors.error,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <MainStack />
    </NavigationContainer>
  );
};

export default AppNavigator;
