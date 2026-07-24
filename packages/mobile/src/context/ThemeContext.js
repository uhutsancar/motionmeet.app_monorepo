import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const lightTheme = {
  background: '#F5F6FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  surfaceLight: '#EEF1F7',
  text: '#171A2B',
  textSecondary: '#61677A',
  textMuted: '#9298AA',
  border: '#E2E6EF',
  primary: '#6558F5',
  primaryPressed: '#5145DB',
  primarySoft: '#EEEAFE',
  secondary: '#12A88A',
  secondarySoft: '#E4F8F3',
  success: '#0E9F6E',
  warning: '#E89614',
  danger: '#E5484D',
  overlay: 'rgba(16, 22, 38, 0.52)',
  shadow: '#171A2B',
};

export const darkTheme = {
  background: '#090D18',
  surface: '#121827',
  card: '#121827',
  surfaceLight: '#1A2234',
  text: '#F7F8FC',
  textSecondary: '#AEB7C9',
  textMuted: '#747F96',
  border: '#273247',
  primary: '#8A80FF',
  primaryPressed: '#A199FF',
  primarySoft: '#28244B',
  secondary: '#38D2B0',
  secondarySoft: '#123B37',
  success: '#33C795',
  warning: '#F7B955',
  danger: '#FF6B70',
  overlay: 'rgba(0, 0, 0, 0.68)',
  shadow: '#000000',
};

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [savedMode, setSavedMode] = useState(null);

  useEffect(() => {
    let active = true;

    const loadTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('appTheme');
        if (active && (storedTheme === 'dark' || storedTheme === 'light')) {
          setSavedMode(storedTheme);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };

    loadTheme();
    return () => {
      active = false;
    };
  }, []);

  const isDark = savedMode ? savedMode === 'dark' : systemColorScheme === 'dark';

  const toggleTheme = useCallback(async () => {
    const nextMode = isDark ? 'light' : 'dark';
    setSavedMode(nextMode);

    try {
      await AsyncStorage.setItem('appTheme', nextMode);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }, [isDark]);

  const theme = useMemo(() => {
    const palette = isDark ? darkTheme : lightTheme;
    const paperBase = isDark ? MD3DarkTheme : MD3LightTheme;

    return {
      ...paperBase,
      ...palette,
      dark: isDark,
      roundness: 16,
      animation: { scale: 1 },
      colors: {
        ...paperBase.colors,
        primary: palette.primary,
        onPrimary: '#FFFFFF',
        primaryContainer: palette.primarySoft,
        onPrimaryContainer: palette.text,
        secondary: palette.secondary,
        onSecondary: '#FFFFFF',
        secondaryContainer: palette.secondarySoft,
        onSecondaryContainer: palette.text,
        background: palette.background,
        surface: palette.surface,
        surfaceVariant: palette.surfaceLight,
        surfaceDisabled: palette.surfaceLight,
        onBackground: palette.text,
        onSurface: palette.text,
        onSurfaceVariant: palette.textSecondary,
        outline: palette.border,
        outlineVariant: palette.border,
        error: palette.danger,
        onError: '#FFFFFF',
        errorContainer: isDark ? '#4B2025' : '#FDEBEC',
        elevation: {
          ...paperBase.colors.elevation,
          level0: 'transparent',
          level1: palette.surface,
          level2: palette.surface,
          level3: palette.surface,
          level4: palette.surface,
          level5: palette.surface,
        },
      },
    };
  }, [isDark]);

  const value = useMemo(
    () => ({ theme, isDark, toggleTheme }),
    [theme, isDark, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return { theme: darkTheme, isDark: true, toggleTheme: () => {} };
  }
  return context;
};
