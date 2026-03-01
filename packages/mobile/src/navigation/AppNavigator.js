import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

import Feed from '../pages/Feed';
import Routines from '../pages/Routines';
import Exercises from '../pages/Exercises';
import Profile from '../pages/Profile';
import Settings from '../pages/Settings';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Profile Tab Component - Shows current user's profile
const ProfileTab = ({ navigation }) => {
  return <Profile navigation={navigation} />;
};

// Main Stack Navigator
const MainStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="Settings" component={Settings} />
    </Stack.Navigator>
  );
};

import { useTranslation } from 'react-i18next';

// Tab Navigator
const TabNavigator = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Routines') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Exercises') {
            iconName = focused ? 'barbell' : 'barbell-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'SettingsTab') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size + 2} color={color} />; // Slightly larger icons
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surfaceLight,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 75,
          paddingBottom: 15,
          paddingTop: 10,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        headerShown: false,
        tabBarLabelStyle: { fontSize: 11, marginTop: 4, fontWeight: '600' }
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={Feed}
        options={{ tabBarLabel: t('tabs.feed') }}
      />
      <Tab.Screen 
        name="Routines" 
        component={Routines} 
        options={{ tabBarLabel: t('tabs.routines') }}
      />
      <Tab.Screen 
        name="Exercises" 
        component={Exercises} 
        options={{ tabBarLabel: t('tabs.exercises') }}
      />
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileTab}
        options={{ tabBarLabel: t('tabs.profile') }}
      />
      <Tab.Screen 
        name="SettingsTab" 
        component={Settings}
        options={{ tabBarLabel: t('settings.title') }}
      />
    </Tab.Navigator>
  );
};

// Messages Stack Navigator
const MessagesStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessagesList" component={Messages} />
      <Stack.Screen name="ChatBox" component={ChatBox} />
    </Stack.Navigator>
  );
};

// Profile Stack Navigator
const ProfileStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={Profile} />
      <Stack.Screen name="Connections" component={Connections} />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <MainStack />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default AppNavigator;
