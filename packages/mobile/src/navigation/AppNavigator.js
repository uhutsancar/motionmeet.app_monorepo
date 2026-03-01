import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../hooks/useSocket';

import Feed from '../pages/Feed';
import Routines from '../pages/Routines';
import Exercises from '../pages/Exercises';
import Profile from '../pages/Profile';
import Settings from '../pages/Settings';
import Messages from '../pages/Messages';
import ChatBox from '../pages/ChatBox';
import Statistics from '../pages/Statistics';
import Connections from '../pages/Connections';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* ─── Messages Stack ─────────────────────────────────────────────────────────── */
const MessagesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MessagesList" component={Messages} />
    <Stack.Screen name="ChatBox" component={ChatBox} />
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
  </Stack.Navigator>
);

/* ─── Tab Navigator ──────────────────────────────────────────────────────────── */
const TabNavigator = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { socketRef } = useSocket();
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Listen for new messages globally to show badge
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onMsg = () => setUnreadMessages(prev => prev + 1);
    socket.on('message_received', onMsg);
    return () => socket.off('message_received', onMsg);
  }, [socketRef.current]);

  const iconForRoute = (name, focused) => {
    const map = {
      Home: [focused ? 'home' : 'home-outline'],
      Routines: [focused ? 'document-text' : 'document-text-outline'],
      Exercises: [focused ? 'barbell' : 'barbell-outline'],
      MessagesTab: [focused ? 'chatbubbles' : 'chatbubbles-outline'],
      ProfileTab: [focused ? 'person' : 'person-outline'],
      SettingsTab: [focused ? 'settings' : 'settings-outline'],
    };
    return (map[name] || ['ellipse-outline'])[0];
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = iconForRoute(route.name, focused);
          const iconSize = 26; // Increased size as requested
          
          if (route.name === 'MessagesTab' && unreadMessages > 0) {
            return (
              <View style={{ width: iconSize, height: iconSize, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name={iconName} size={iconSize} color={color} />
                <View style={{
                  position: 'absolute', top: -1, right: -3,
                  backgroundColor: theme.primary, borderRadius: 6,
                  minWidth: 14, height: 14, justifyContent: 'center', alignItems: 'center',
                  borderWidth: 1.5, borderColor: theme.surfaceLight
                }}>
                  <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </Text>
                </View>
              </View>
            );
          }
          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarShowLabel: false, // Ensure labels are hidden
        tabBarStyle: {
          backgroundColor: theme.surfaceLight,
          borderTopColor: theme.border,
          borderTopWidth: 0.5,
          height: 65, // Comfortable height for icons only
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 10,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={Feed} options={{ tabBarLabel: t('tabs.feed') }} />
      <Tab.Screen name="Routines" component={Routines} options={{ tabBarLabel: t('tabs.routines') }} />
      <Tab.Screen name="Exercises" component={Exercises} options={{ tabBarLabel: t('tabs.exercises') }} />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesStack}
        options={{ tabBarLabel: t('tabs.messages') }}
        listeners={{ tabPress: () => setUnreadMessages(0) }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{ tabBarLabel: t('tabs.profile') }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={Settings}
        options={{ tabBarLabel: t('tabs.settings') }}
      />
    </Tab.Navigator>
  );
};

/* ─── Root ───────────────────────────────────────────────────────────────────── */
const AppNavigator = () => (
  <SafeAreaProvider>
    <NavigationContainer>
      <MainStack />
    </NavigationContainer>
  </SafeAreaProvider>
);

export default AppNavigator;
