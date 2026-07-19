import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client'; // axios instance

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('token');
        if (storedToken) {
          setToken(storedToken);
          // fetch me
          const res = await api.get('/auth/me', { headers: { Authorization: `Bearer ${storedToken}` }});
          if (res.data.success) {
            setUser(res.data.user);
          } else {
            await SecureStore.deleteItemAsync('token');
            setToken(null);
          }
        }
      } catch (e) {
        console.error("Failed to load token:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadToken();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        await SecureStore.setItemAsync('token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
  };

  const register = async (userData) => {
    try {
      const res = await api.post('/auth/register', userData);
      if (res.data.success) {
        await SecureStore.setItemAsync('token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
  };

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoaded, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return {
    user: context.user,
    getToken: async () => context.token, // Async function like Clerk's getToken
    isLoaded: context.isLoaded,
    isSignedIn: !!context.user,
    userId: context.user?.id,
    signOut: context.logout,
    login: context.login,
    register: context.register
  };
};
