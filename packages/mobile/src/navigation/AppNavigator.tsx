import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthContext } from '../context/AuthProvider';
import { getUserConversations } from '../api/endpoints';
import type { Message } from '@motionmeet/shared';

import Feed from '../pages/Feed';
import Routines from '../pages/Routines';
import Exercises from '../pages/Exercises';
import Profile from '../pages/Profile';
import Messages from '../pages/Messages';
import Settings from '../pages/Settings';
import ProfileEditScreen from '../pages/ProfileEditScreen';
import ChatBox from '../pages/ChatBox';
import Statistics from '../pages/Statistics';
import Connections from '../pages/Connections';
import ExerciseDetail from '../pages/ExerciseDetail';
import MuscleDistribution from '../pages/MuscleDistribution';
import WorkoutSummaryScreen from '../pages/WorkoutSummaryScreen';
import WorkoutDetailScreen from '../pages/WorkoutDetailScreen';
import ActiveWorkoutScreen from '../pages/ActiveWorkoutScreen';
import MonthlyReportScreen from '../pages/MonthlyReportScreen';
import WorkoutsDetailScreen from '../pages/WorkoutsDetailScreen';
import DurationDetailScreen from '../pages/DurationDetailScreen';
import VolumeDetailScreen from '../pages/VolumeDetailScreen';
import SetsDetailScreen from '../pages/SetsDetailScreen';
import NotificationsScreen from '../pages/NotificationsScreen';
import PrivacyScreen from '../pages/PrivacyScreen';
import SupportScreen from '../pages/SupportScreen';
import PricingScreen from '../pages/PricingScreen';
import AdvancedStatisticsScreen from '../pages/AdvancedStatisticsScreen';
import MuscleDistributionBodyScreen from '../pages/MuscleDistributionBodyScreen';
import MainExercisesScreen from '../pages/MainExercisesScreen';
import LeaderboardScreen from '../pages/LeaderboardScreen';

const loadSettings = () => Settings;
const loadProfileEdit = () => ProfileEditScreen;
const loadChatBox = () => ChatBox;
const loadStatistics = () => Statistics;
const loadConnections = () => Connections;
const loadExerciseDetail = () => ExerciseDetail;
const loadMuscleDistribution = () => MuscleDistribution;
const loadWorkoutSummary = () => WorkoutSummaryScreen;
const loadWorkoutDetail = () => WorkoutDetailScreen;
const loadActiveWorkout = () => ActiveWorkoutScreen;
const loadMonthlyReport = () => MonthlyReportScreen;
const loadWorkoutsDetail = () => WorkoutsDetailScreen;
const loadDurationDetail = () => DurationDetailScreen;
const loadVolumeDetail = () => VolumeDetailScreen;
const loadSetsDetail = () => SetsDetailScreen;
const loadNotifications = () => NotificationsScreen;
const loadPrivacy = () => PrivacyScreen;
const loadSupport = () => SupportScreen;
const loadPricing = () => PricingScreen;
const loadAdvancedStatistics = () => AdvancedStatisticsScreen;
const loadMuscleDistributionBody = () => MuscleDistributionBodyScreen;
const loadMainExercises = () => MainExercisesScreen;
const loadLeaderboard = () => LeaderboardScreen;

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
  const { getToken } = useAuthContext();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const tabBarBaseHeight = fontScale > 1.5 ? 72 : fontScale > 1.2 ? 66 : 60;
  const [unreadMessages, setUnreadMessages] = useState(0);
  const messagesTabFocusedRef = useRef(false);

  useEffect(() => {
    let active = true;
    const initializeUnread = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await getUserConversations(token);
        if (active && data.success) {
          setUnreadMessages(
            (data.conversations || []).reduce(
              (total, conversation) => total + Number(conversation.unreadCount || 0),
              0,
            ),
          );
        }
      } catch {
        // Navigation remains available if the badge cannot be initialized.
      }
    };
    void initializeUnread();
    return () => {
      active = false;
    };
  }, [getToken]);

  // Listen for new messages globally to show badge
  useEffect(() => {
    if (!socket) return;
    const onMsg = async (msg: Message) => {
      if (messagesTabFocusedRef.current) return;
      setUnreadMessages(prev => prev + 1);
      try {
        const stored = await AsyncStorage.getItem('@mm_notification_prefs');
        const preferences: { newMessage?: boolean } = stored ? JSON.parse(stored) : {};
        if (preferences.newMessage === false) return;
      } catch {
        // Invalid preferences fall back to enabled.
      }
      Toast.show({
        type: 'info',
        text1: (typeof msg.from_user_id === 'object' ? msg.from_user_id.full_name : '') || t('notifications.new_message', 'Yeni Mesaj'),
        text2: msg?.text || t('notifications.you_have_message', 'Size yeni bir mesaj geldi.'),
        position: 'top',
        topOffset: 60,
        visibilityTime: 4000,
      });
    };
    socket.on('message_received', onMsg);
    return () => {
      socket.off('message_received', onMsg);
    };
  }, [socket, t]);

  const iconForRoute = useCallback((name: string, focused: boolean): React.ComponentProps<typeof Ionicons>['name'] => {
    const map: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
      Home:        focused ? 'home'              : 'home-outline',
      Routines:    focused ? 'fitness'           : 'fitness-outline',
      Exercises:   focused ? 'barbell'           : 'barbell-outline',
      MessagesTab: focused ? 'chatbubbles'       : 'chatbubbles-outline',
      ProfileTab:  focused ? 'person-circle'     : 'person-circle-outline',
      SettingsTab: focused ? 'settings'          : 'settings-outline',
    };
    return map[name] || 'ellipse-outline';
  }, []);

  const screenOptions = useCallback(({ route }: { route: { name: string } }): BottomTabNavigationOptions => ({
    tabBarIcon: ({ focused, color }) => {
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
      height: tabBarBaseHeight + insets.bottom,
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
  }), [theme, unreadMessages, iconForRoute, insets.bottom, tabBarBaseHeight]);

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Home" component={Feed} options={{ tabBarLabel: t('tabs.feed', 'Keşfet') }} />
      <Tab.Screen name="Routines" component={Routines} options={{ tabBarLabel: t('tabs.routines', 'Rutinler') }} />
      <Tab.Screen name="Exercises" component={Exercises} options={{ tabBarLabel: t('tabs.exercises', 'Egzersiz') }} />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesStack}
        options={{ tabBarLabel: t('tabs.messages', 'Mesajlar') }}
        listeners={{
          focus: () => {
            messagesTabFocusedRef.current = true;
            setUnreadMessages(0);
          },
          blur: () => {
            messagesTabFocusedRef.current = false;
          },
          tabPress: () => setUnreadMessages(0),
        }}
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
