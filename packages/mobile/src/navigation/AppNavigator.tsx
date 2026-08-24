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
import { WEB_URL } from '../config/environment';
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
const loadSearch = () => require('../pages/SearchScreen').default;
const loadLicenses = () => require('../pages/LicensesScreen').default;
const loadPost = () => require('../pages/PostScreen').default;
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
    {/* Search is a place of its own, pushed from the field on Keşfet, so the
        grid is not rebuilt on every keystroke and Cancel returns to it. */}
    <Stack.Screen name="SearchScreen" getComponent={loadSearch} />
    {/* Where a shared MotionMeet link lands once the app is installed. */}
    <Stack.Screen name="PostScreen" getComponent={loadPost} />
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

  // One height on every device. The row itself never changes size — only the
  // safe-area padding underneath it does — so the bar sits at the same place on
  // a gesture-bar phone, a button-bar phone and a tablet.
  const barHeight = fontScale > 1.4 ? 60 : 52;

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
        // Flat, edge to edge, one hairline against the content above and
        // nothing else: no rounded shelf, no floating shadow, no pill behind
        // the icon. The whole bar is the same ground as the screen it belongs
        // to, which is what makes it disappear until it is looked at.
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 6),
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
                  // The whole column is the target, so the tap area is a
                  // fifth of the screen rather than the glyph itself.
                  style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isProfile && avatar ? (
                    <Image
                      source={{ uri: avatar }}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        // The ring is the selected state for the avatar, the
                        // way the filled glyph is for the others. It is always
                        // drawn so the avatar never changes size between tabs.
                        borderWidth: 1.5,
                        borderColor: focused ? theme.text : 'transparent',
                      }}
                    />
                  ) : (
                    <Ionicons
                      name={iconName}
                      size={26}
                      // Monochrome: weight, not hue, says which tab is open.
                      color={focused ? theme.text : theme.textMuted}
                    />
                  )}
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

/**
 * How a link from outside the app turns into a screen.
 *
 * Both forms of the same address are accepted: the custom scheme, which is what
 * the server's share page hands to an installed app, and the https URL that
 * everyone actually pastes into a chat. Whichever arrives, `post/:postId`
 * resolves to the post itself rather than dropping the reader on the feed.
 */
const linking = {
  prefixes: ['motionmeet://', `${WEB_URL}/`],
  config: {
    screens: {
      PostScreen: 'post/:postId',
      Profile: 'profile/:userId',
    },
  },
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
    <NavigationContainer theme={navigationTheme} linking={linking}>
      <MainStack />
    </NavigationContainer>
  );
};

export default AppNavigator;
