import React, { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, Surface } from 'react-native-paper';
import { useAuthContext } from "../context/AuthProvider";
import { fetchUser } from '../features/user/userSlice';
import { setAuthToken, setAuthTokenProvider } from '../api/client';
import AppNavigator from './AppNavigator';
import LoginScreen from '../pages/Login';
import { SocketProvider } from '../context/SocketProvider';
import { useTheme } from '../context/ThemeContext';
import { logHandledError } from '../utils/feedback';
import { useAppDispatch } from '../store/hooks';
import loadingLogo from '../../assets/icon.png';

const AuthNavigator = () => {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuthContext();
  const dispatch = useAppDispatch();
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
            try {
              await dispatch(fetchUser(token)).unwrap();
            } catch (err: any) {
              if (err?.message?.includes('401') || err?.message?.includes('403')) {
                await signOut();
              }
            }
          }
        } catch (error) {
          logHandledError('load-current-user', error);
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
  }, [isSignedIn, isLoaded, dispatch, getToken, signOut]);

  if (!isLoaded) {
    return (
      <Surface elevation={0} style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Image 
          source={loadingLogo}
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
  loadingIndicator: {
    marginBottom: 12,
  },
});

export default AuthNavigator;
