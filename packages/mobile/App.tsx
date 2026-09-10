import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { AuthProvider } from './src/context/AuthProvider';
import { store } from './src/store/store';
import AuthNavigator from './src/navigation/AuthNavigator';
import { StatusBar } from 'expo-status-bar';
import './src/i18n'; // Initialize i18n
import { ThemeProvider } from './src/context/ThemeContext';
import { useTheme } from './src/context/ThemeContext';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppToast from './src/components/AppToast';
import { ensureAdsInitialized } from './src/services/adsInit';

const AppContent = () => {
  const { theme, isDark } = useTheme();

  return (
    <PaperProvider theme={theme}>
      <AuthNavigator />
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={theme.background}
      />
      <AppToast />
    </PaperProvider>
  );
};

export default function App() {
  // Consent + SDK init run once at startup, independent of auth state, so
  // the first ad slot to mount doesn't have to wait on them itself.
  useEffect(() => {
    void ensureAdsInitialized();
  }, []);

  return (
    // Gestures are routed through the native handler tree, which the swipeable
    // tab pager needs in order to negotiate with the carousels inside screens.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <ThemeProvider>
          <SafeAreaProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
