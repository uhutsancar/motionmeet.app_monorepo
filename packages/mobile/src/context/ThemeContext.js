import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const lightTheme = {
  background: '#F6F7F5',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  surfaceLight: '#F0F2EF',
  text: '#121417',
  textSecondary: '#555D68',
  textMuted: '#69717D',
  border: '#E0E4DF',
  primary: '#5D50E6',
  primaryPressed: '#493CCB',
  primarySoft: '#EEECFF',
  secondary: '#078E79',
  secondarySoft: '#E6F5F1',
  energy: '#B9ED56',
  energySoft: '#F1F9DE',
  coral: '#F2665C',
  success: '#0D9468',
  warning: '#D98A12',
  danger: '#D94249',
  overlay: 'rgba(14, 18, 25, 0.56)',
  shadow: '#111318',
};

export const darkTheme = {
  background: '#090B0E',
  surface: '#14171B',
  card: '#14171B',
  surfaceLight: '#1D2126',
  text: '#F5F6F4',
  textSecondary: '#B5BBC4',
  textMuted: '#929AA5',
  border: '#292E35',
  primary: '#948AFF',
  primaryPressed: '#AAA2FF',
  primarySoft: '#2A2645',
  secondary: '#48CDB3',
  secondarySoft: '#173B35',
  energy: '#C2F263',
  energySoft: '#2A361C',
  coral: '#FF766D',
  success: '#39C08E',
  warning: '#F0B04E',
  danger: '#F1686E',
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
        if (__DEV__) console.log('[Theme] Could not load saved preference', error?.message);
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
      if (__DEV__) console.log('[Theme] Could not save preference', error?.message);
    }
  }, [isDark]);

  const theme = useMemo(() => {
    const palette = isDark ? darkTheme : lightTheme;
    const paperBase = isDark ? MD3DarkTheme : MD3LightTheme;

    return {
      ...paperBase,
      ...palette,
      dark: isDark,
      roundness: 12,
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
