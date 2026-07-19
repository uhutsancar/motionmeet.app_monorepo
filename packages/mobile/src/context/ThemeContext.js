import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const lightTheme = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceLight: '#F3F4F6',
  text: '#111827',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  primary: '#3B82F6',
  textSecondary: '#4B5563',
};

export const darkTheme = {
  background: '#0C0C0E',
  surface: '#141417',
  surfaceLight: '#1F1F23',
  text: '#F3F4F6',
  textMuted: '#4B5563',
  border: '#252529',
  primary: '#60A5FA',
  textSecondary: '#D1D5DB',
};

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [savedMode, setSavedMode] = useState(null);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('appTheme');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setSavedMode(savedTheme);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  const isDark = savedMode ? savedMode === 'dark' : systemColorScheme === 'dark';

  const toggleTheme = async () => {
    try {
      const newTheme = !isDark;
      setSavedMode(newTheme ? 'dark' : 'light');
      await AsyncStorage.setItem('appTheme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const theme = useMemo(() => {
    const palette = isDark ? darkTheme : lightTheme;
    const paperBase = isDark ? MD3DarkTheme : MD3LightTheme;

    return {
      ...paperBase,
      ...palette,
      dark: isDark,
      roundness: 12,
      colors: {
        ...paperBase.colors,
        primary: palette.primary,
        background: palette.background,
        surface: palette.surface,
        surfaceVariant: palette.surfaceLight,
        onBackground: palette.text,
        onSurface: palette.text,
        onSurfaceVariant: palette.textSecondary,
        outline: palette.border,
        outlineVariant: palette.border,
      },
    };
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
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
