import React, { useEffect, useState } from 'react';

import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';
import Toast from 'react-native-toast-message';

import Feed from '../pages/Feed';
import Routines from '../pages/Routines';
import Exercises from '../pages/Exercises';
import Profile from '../pages/Profile';
import Settings from '../pages/Settings';
import Messages from '../pages/Messages';
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

// Missing Statistics Screens
import AdvancedStatisticsScreen from '../pages/AdvancedStatisticsScreen';
import MuscleDistributionBodyScreen from '../pages/MuscleDistributionBodyScreen';
import MainExercisesScreen from '../pages/MainExercisesScreen';
import LeaderboardScreen from '../pages/LeaderboardScreen';

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
    <Stack.Screen name="Settings" component={Settings} />
    <Stack.Screen name="Statistics" component={Statistics} />
    <Stack.Screen name="Connections" component={Connections} />
  </Stack.Navigator>
);

/* ─── Main Stack (wraps tabs + allows extra modals) ─────────────────────────── */
const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabs" component={TabNavigator} />
    <Stack.Screen name="Profile" component={Profile} />
    <Stack.Screen name="Settings" component={Settings} />
    <Stack.Screen name="Statistics" component={Statistics} />
    <Stack.Screen name="ChatBox" component={ChatBox} />
    <Stack.Screen name="Connections" component={Connections} />
    <Stack.Screen name="ExerciseDetail" component={ExerciseDetail} />
    <Stack.Screen name="MuscleDistribution" component={MuscleDistribution} />
    <Stack.Screen name="WorkoutSummaryScreen" component={WorkoutSummaryScreen} />
    <Stack.Screen name="WorkoutDetailScreen" component={WorkoutDetailScreen} />
    <Stack.Screen name="ActiveWorkoutScreen" component={ActiveWorkoutScreen} />
    <Stack.Screen name="MonthlyReportScreen" component={MonthlyReportScreen} />
    <Stack.Screen name="WorkoutsDetailScreen" component={WorkoutsDetailScreen} />
    <Stack.Screen name="DurationDetailScreen" component={DurationDetailScreen} />
    <Stack.Screen name="VolumeDetailScreen" component={VolumeDetailScreen} />
    <Stack.Screen name="SetsDetailScreen" component={SetsDetailScreen} />
    <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
    <Stack.Screen name="PrivacyScreen" component={PrivacyScreen} />
    <Stack.Screen name="SupportScreen" component={SupportScreen} />
    <Stack.Screen name="PricingScreen" component={PricingScreen} />
    <Stack.Screen name="AdvancedStatisticsScreen" component={AdvancedStatisticsScreen} />
    <Stack.Screen name="MuscleDistributionBodyScreen" component={MuscleDistributionBodyScreen} />
    <Stack.Screen name="MainExercisesScreen" component={MainExercisesScreen} />
    <Stack.Screen name="LeaderboardScreen" component={LeaderboardScreen} />
  </Stack.Navigator>
);

/* ─── Tab Navigator ──────────────────────────────────────────────────────────── */
const TabNavigator = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { socket } = useSocket();
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Listen for new messages globally to show badge
  useEffect(() => {
    if (!socket) return;
    const onMsg = (msg) => {
      setUnreadMessages(prev => prev + 1);
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

  const iconForRoute = (name, focused) => {
    const map = {
      Home:        focused ? 'home'              : 'home-outline',
      Routines:    focused ? 'fitness'           : 'fitness-outline',
      Exercises:   focused ? 'barbell'           : 'barbell-outline',
      MessagesTab: focused ? 'chatbubbles'       : 'chatbubbles-outline',
      ProfileTab:  focused ? 'person-circle'     : 'person-circle-outline',
      SettingsTab: focused ? 'settings'          : 'settings-outline',
    };
    return map[name] || 'ellipse-outline';
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = iconForRoute(route.name, focused);
          const iconSize = 26; // Increased size as requested
          
          if (route.name === 'MessagesTab' && unreadMessages > 0) {
            return (
              <Surface elevation={0} style={{ width: iconSize, height: iconSize, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name={iconName} size={iconSize} color={color} />
                <Surface elevation={0} style={{
                  position: 'absolute', top: -1, right: -3,
                  backgroundColor: theme.primary, borderRadius: 6,
                  minWidth: 14, height: 14, justifyContent: 'center', alignItems: 'center',
                  borderWidth: 1.5, borderColor: theme.surfaceLight
                }}>
                  <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </Text>
                </Surface>
              </Surface>
            );
          }
          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
        tabBarStyle: {
          backgroundColor: theme.surfaceLight,
          borderTopColor: theme.border,
          borderTopWidth: 0.5,
          height: 78,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -3 },
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 10,
          paddingBottom: 8,
        },
        headerShown: false,
      })}
    >
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
