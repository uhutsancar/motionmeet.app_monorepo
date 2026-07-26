import React, { useEffect, useState, useCallback } from 'react';

import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Feed from '../pages/Feed';
import Routines from '../pages/Routines';
import Exercises from '../pages/Exercises';
import Profile from '../pages/Profile';
import Messages from '../pages/Messages';

const loadSettings = () => require('../pages/Settings').default;
const loadProfileEdit = () => require('../pages/ProfileEditScreen').default;
const loadChatBox = () => require('../pages/ChatBox').default;
const loadStatistics = () => require('../pages/Statistics').default;
const loadConnections = () => require('../pages/Connections').default;
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
const loadNotifications = () => require('../pages/NotificationsScreen').default;
const loadPrivacy = () => require('../pages/PrivacyScreen').default;
const loadSupport = () => require('../pages/SupportScreen').default;
const loadPricing = () => require('../pages/PricingScreen').default;
const loadAdvancedStatistics = () => require('../pages/AdvancedStatisticsScreen').default;
const loadMuscleDistributionBody = () => require('../pages/MuscleDistributionBodyScreen').default;
const loadMainExercises = () => require('../pages/MainExercisesScreen').default;
const loadLeaderboard = () => require('../pages/LeaderboardScreen').default;

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* ─── Messages Stack ─────────────────────────────────────────────────────────── */
const MessagesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MessagesList" component={Messages} />
  </Stack.Navigator>
);

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
  </Stack.Navigator>
);

/* ─── Main Stack (wraps tabs + allows extra modals) ─────────────────────────── */
const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabs" component={TabNavigator} />
    <Stack.Screen name="Profile" component={Profile} />
    <Stack.Screen name="ProfileEdit" getComponent={loadProfileEdit} />
    <Stack.Screen name="Settings" getComponent={loadSettings} />
    <Stack.Screen name="Statistics" getComponent={loadStatistics} />
    <Stack.Screen name="ChatBox" getComponent={loadChatBox} />
    <Stack.Screen name="Connections" getComponent={loadConnections} />
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
    <Stack.Screen name="NotificationsScreen" getComponent={loadNotifications} />
    <Stack.Screen name="PrivacyScreen" getComponent={loadPrivacy} />
    <Stack.Screen name="SupportScreen" getComponent={loadSupport} />
    <Stack.Screen name="PricingScreen" getComponent={loadPricing} />
    <Stack.Screen name="AdvancedStatisticsScreen" getComponent={loadAdvancedStatistics} />
    <Stack.Screen name="MuscleDistributionBodyScreen" getComponent={loadMuscleDistributionBody} />
    <Stack.Screen name="MainExercisesScreen" getComponent={loadMainExercises} />
    <Stack.Screen name="LeaderboardScreen" getComponent={loadLeaderboard} />
  </Stack.Navigator>
);

/* ─── Tab Navigator ──────────────────────────────────────────────────────────── */
const TabNavigator = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Listen for new messages globally to show badge
  useEffect(() => {
    if (!socket) return;
    const onMsg = async (msg) => {
      setUnreadMessages(prev => prev + 1);
      try {
        const stored = await AsyncStorage.getItem('@mm_notification_prefs');
        const preferences = stored ? JSON.parse(stored) : {};
        if (preferences.newMessage === false) return;
      } catch {
        // Invalid preferences fall back to enabled.
      }
      Toast.show({
        type: 'info',
        text1: msg?.senderName || t('notifications.new_message', 'Yeni Mesaj'),
        text2: msg?.text || t('notifications.you_have_message', 'Size yeni bir mesaj geldi.'),
        position: 'top',
        topOffset: 60,
        visibilityTime: 4000,
      });
    };
    socket.on('message_received', onMsg);
    return () => socket.off('message_received', onMsg);
  }, [socket, t]);

  const iconForRoute = useCallback((name, focused) => {
    const map = {
      Home:        focused ? 'home'              : 'home-outline',
      Routines:    focused ? 'fitness'           : 'fitness-outline',
      Exercises:   focused ? 'barbell'           : 'barbell-outline',
      MessagesTab: focused ? 'chatbubbles'       : 'chatbubbles-outline',
      ProfileTab:  focused ? 'person-circle'     : 'person-circle-outline',
      SettingsTab: focused ? 'settings'          : 'settings-outline',
    };
    return map[name] || 'ellipse-outline';
  }, []);

  const screenOptions = useCallback(({ route }) => ({
    tabBarIcon: ({ focused, color, size }) => {
      const iconName = iconForRoute(route.name, focused);
      const iconSize = 22;
      const showBadge = route.name === 'MessagesTab' && unreadMessages > 0;

      return (
        <View style={{
          width: 42,
          height: 30,
          justifyContent: 'center',
          alignItems: 'center',
          borderTopWidth: focused ? 2 : 0,
          borderTopColor: focused ? theme.primary : 'transparent',
        }}>
          <Ionicons name={iconName} size={iconSize} color={color} />
          {showBadge && (
            <View style={{
              position: 'absolute',
              top: 0,
              right: 2,
              backgroundColor: theme.danger,
              borderRadius: 7,
              minWidth: 15,
              height: 15,
              paddingHorizontal: 3,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: theme.surface,
            }}>
              <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '900' }}>
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </Text>
            </View>
          )}
        </View>
      );
    },
    tabBarActiveTintColor: theme.primary,
    tabBarInactiveTintColor: theme.textMuted,
    tabBarShowLabel: true,
    tabBarHideOnKeyboard: true,
    tabBarLabelStyle: {
      fontSize: 10,
      fontWeight: '700',
      marginTop: 2,
      marginBottom: 0,
    },
    tabBarStyle: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderTopWidth: 1,
      height: 60 + insets.bottom,
      paddingTop: 5,
      paddingBottom: Math.max(insets.bottom, 5),
      elevation: 0,
    },
    tabBarItemStyle: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerShown: false,
    lazy: true,
    freezeOnBlur: true,
  }), [theme, unreadMessages, iconForRoute, insets.bottom]);

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Home" component={Feed} options={{ tabBarLabel: t('tabs.feed', 'Keşfet') }} />
      <Tab.Screen name="Routines" component={Routines} options={{ tabBarLabel: t('tabs.routines', 'Rutinler') }} />
      <Tab.Screen name="Exercises" component={Exercises} options={{ tabBarLabel: t('tabs.exercises', 'Egzersiz') }} />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesStack}
        options={{ tabBarLabel: t('tabs.messages', 'Mesajlar') }}
        listeners={{ tabPress: () => setUnreadMessages(0) }}
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
