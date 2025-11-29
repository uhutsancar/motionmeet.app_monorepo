import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import { View, Text, StyleSheet } from 'react-native';

// Import pages
import Login from '../pages/Login';
import Feed from '../pages/Feed';
import Messages from '../pages/Messages';
import ChatBox from '../pages/ChatBox';
import Connections from '../pages/Connections';
import Discover from '../pages/Discover';
import Profile from '../pages/Profile';
import CreatePost from '../pages/CreatePost';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Bar Icon Component
const TabIcon = ({ focused, icon, label }) => (
    <View style={styles.tabIconContainer}>
        <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icon}</Text>
        <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
    </View>
);

// Main Tab Navigator
const MainTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={{
                tabBarShowLabel: false,
                tabBarStyle: styles.tabBar,
                headerShown: false,
            }}
        >
            <Tab.Screen 
                name="Feed" 
                component={Feed}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon focused={focused} icon="🏠" label="Feed" />
                    ),
                }}
            />
            <Tab.Screen 
                name="MessagesTab" 
                component={Messages}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon focused={focused} icon="💬" label="Messages" />
                    ),
                }}
            />
            <Tab.Screen 
                name="Connections" 
                component={Connections}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon focused={focused} icon="👥" label="Connections" />
                    ),
                }}
            />
            <Tab.Screen 
                name="Discover" 
                component={Discover}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon focused={focused} icon="🔍" label="Discover" />
                    ),
                }}
            />
            <Tab.Screen 
                name="ProfileTab" 
                component={Profile}
                initialParams={{}}
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon focused={focused} icon="👤" label="Profile" />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

// Root Navigator
const RootNavigator = () => {
    const user = useSelector((state) => state.user.value);

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user ? (
                    // Auth Stack
                    <Stack.Screen name="Login" component={Login} />
                ) : (
                    // Main App Stack
                    <>
                        <Stack.Screen name="Main" component={MainTabs} />
                        <Stack.Screen 
                            name="ChatBox" 
                            component={ChatBox}
                            options={{ 
                                headerShown: false,
                                animation: 'slide_from_right'
                            }}
                        />
                        <Stack.Screen 
                            name="Profile" 
                            component={Profile}
                            options={{ 
                                headerShown: false,
                                animation: 'slide_from_right'
                            }}
                        />
                        <Stack.Screen 
                            name="CreatePost" 
                            component={CreatePost}
                            options={{ 
                                headerShown: false,
                                animation: 'slide_from_bottom'
                            }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        height: 70,
        paddingTop: 8,
        paddingBottom: 8,
    },
    tabIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabIcon: {
        fontSize: 22,
    },
    tabIconFocused: {
        transform: [{ scale: 1.1 }],
    },
    tabLabel: {
        fontSize: 10,
        color: '#9ca3af',
        marginTop: 4,
    },
    tabLabelFocused: {
        color: '#6366f1',
        fontWeight: '600',
    },
});

export default RootNavigator;
