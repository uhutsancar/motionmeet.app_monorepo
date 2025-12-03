import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useDispatch } from 'react-redux';
import { fetchUser } from '../features/user/userSlice';
import { setAuthToken } from '../api/client';
import AppNavigator from './AppNavigator';
import LoginScreen from '../pages/Login';

const AuthNavigator = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const dispatch = useDispatch();

  useEffect(() => {
    const loadUserData = async () => {
      if (isSignedIn) {
        try {
          const token = await getToken();
          if (token) {
            // Set token in API client for all future requests
            setAuthToken(token);
            // Fetch user data from backend
            dispatch(fetchUser());
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      } else {
        // Clear token when signed out
        setAuthToken(null);
      }
    };

    if (isLoaded) {
      loadUserData();
    }
  }, [isSignedIn, isLoaded, dispatch, getToken]);

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Image 
          source={require('../../assets/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return isSignedIn ? <AppNavigator /> : <LoginScreen />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
});

export default AuthNavigator;
