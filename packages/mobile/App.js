import React from 'react';
import { Provider } from 'react-redux';
import { AuthProvider } from './src/context/AuthProvider';
import Toast from 'react-native-toast-message';
import { store } from './src/store/store';
import AuthNavigator from './src/navigation/AuthNavigator';
import { StatusBar } from 'expo-status-bar';
import './src/i18n'; // Initialize i18n
import { ThemeProvider } from './src/context/ThemeContext';
import { useTheme } from './src/context/ThemeContext';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const AppContent = () => {
  const { theme, isDark } = useTheme();

  return (
    <PaperProvider theme={theme}>
      <AuthNavigator />
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={theme.background}
      />
      <Toast />
    </PaperProvider>
  );
};

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </Provider>
  );
}
