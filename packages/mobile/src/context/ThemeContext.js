import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightTheme = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceLight: '#F3F4F6',
  text: '#111827',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  primary: '#3B82F6'
};

export const darkTheme = {
  background: '#0C0C0E',
  surface: '#141417',
  surfaceLight: '#1F1F23',
  text: '#F3F4F6',
  textMuted: '#4B5563',
  border: '#252529',
  primary: '#60A5FA'
};

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('appTheme');
        if (savedTheme !== null) {
          setIsDark(savedTheme === 'dark');
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    try {
      const newTheme = !isDark;
      setIsDark(newTheme);
      await AsyncStorage.setItem('appTheme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

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
