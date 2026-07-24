import React, { useEffect } from 'react';
import { Image } from 'react-native';
import { ActivityIndicator, Text, Surface } from 'react-native-paper';
import { useAuthContext } from "../context/AuthProvider";
import { useDispatch } from 'react-redux';
import { fetchUser } from '../features/user/userSlice';
import { setAuthToken, setAuthTokenProvider } from '../api/client';
import AppNavigator from './AppNavigator';
import LoginScreen from '../pages/Login';
import { SocketProvider } from '../context/SocketProvider';
import { useTheme } from '../context/ThemeContext';

const AuthNavigator = () => {
  const { isLoaded, isSignedIn, getToken } = useAuthContext();
  const dispatch = useDispatch();
  const { theme } = useTheme();

  useEffect(() => {
    const loadUserData = async () => {
      if (isSignedIn) {
        try {
          setAuthTokenProvider(getToken);
          const token = await getToken();
          if (token) {
            // Set token in API client for all future requests
            setAuthToken(token);
            // Fetch user data from backend
            dispatch(fetchUser(token));
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      } else {
        // Clear token when signed out
        setAuthTokenProvider(null);
        setAuthToken(null);
      }
    };

    if (isLoaded) {
      loadUserData();
    }
  }, [isSignedIn, isLoaded, dispatch, getToken]);

  if (!isLoaded) {
    return (
      <Surface elevation={0} style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Image 
          source={require('../../assets/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator color={theme.primary} style={styles.loadingIndicator} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading...</Text>
      </Surface>
    );
  }

  return isSignedIn ? (
    <SocketProvider>
      <AppNavigator />
    </SocketProvider>
  ) : <LoginScreen />;
};

const styles = {
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
  loadingIndicator: {
    marginBottom: 12,
  },
};

export default AuthNavigator;
