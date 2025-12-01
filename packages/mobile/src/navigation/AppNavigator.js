import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Pages (will be created)
import Feed from '../pages/Feed';
import Videos from '../pages/Videos';
import Messages from '../pages/Messages';
import Discover from '../pages/Discover';
import Profile from '../pages/Profile';

const Tab = createBottomTabNavigator();

const AppNavigator = () => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Videos') {
                iconName = focused ? 'play-circle' : 'play-circle-outline';
              } else if (route.name === 'Messages') {
                iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              } else if (route.name === 'Discover') {
                iconName = focused ? 'search' : 'search-outline';
              } else if (route.name === 'Profile') {
                iconName = focused ? 'person' : 'person-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#3b82f6',
            tabBarInactiveTintColor: '#64748b',
            tabBarStyle: {
              backgroundColor: '#0f172a',
              borderTopWidth: 0,
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            headerShown: false,
            tabBarShowLabel: false,
          })}
        >
          <Tab.Screen name="Home" component={Feed} />
          <Tab.Screen name="Videos" component={Videos} />
          <Tab.Screen name="Messages" component={Messages} />
          <Tab.Screen name="Discover" component={Discover} />
          <Tab.Screen name="Profile" component={Profile} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default AppNavigator;
