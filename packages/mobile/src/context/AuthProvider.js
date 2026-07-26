import axios from 'axios';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '../config/environment';
import { API_ROUTES } from '@motionmeet/shared';

const ACCESS_TOKEN_KEY = 'motionmeet_access_token';
const REFRESH_TOKEN_KEY = 'motionmeet_refresh_token';
const ACCESS_EXPIRY_KEY = 'motionmeet_access_expiry';
const LEGACY_TOKEN_KEY = 'token';
const REFRESH_EARLY_MS = 60 * 1000;
const isWeb = Platform.OS === 'web';

const isCompleteSession = (data) =>
  Boolean(
    data?.success &&
    data?.token &&
    (isWeb || data?.refreshToken) &&
    data?.user
  );

const tokenStorage = {
  getItemAsync: async (key) => {
    if (isWeb) return null;
    return SecureStore.getItemAsync(key);
  },
  setItemAsync: async (key, value) => {
    if (isWeb) return;
    await SecureStore.setItemAsync(key, value);
  },
  deleteItemAsync: async (key) => {
    if (isWeb) return;
    await SecureStore.deleteItemAsync(key);
  },
};

const authApi = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: isWeb,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': isWeb ? 'web' : 'mobile',
  },
});

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const accessTokenRef = useRef(null);
  const refreshTokenRef = useRef(null);
  const accessExpiryRef = useRef(0);
  const refreshInFlightRef = useRef(null);

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    accessExpiryRef.current = 0;
    setToken(null);
    setUser(null);
    await Promise.all([
      tokenStorage.deleteItemAsync(ACCESS_TOKEN_KEY),
      tokenStorage.deleteItemAsync(REFRESH_TOKEN_KEY),
      tokenStorage.deleteItemAsync(ACCESS_EXPIRY_KEY),
      tokenStorage.deleteItemAsync(LEGACY_TOKEN_KEY),
    ]);
  }, []);

  const saveSession = useCallback(async (data) => {
    if (!isCompleteSession(data)) {
      throw Object.assign(new Error('Invalid authentication response'), {
        code: 'INVALID_AUTH_RESPONSE',
      });
    }

    const expiresAt = Number(data.accessTokenExpiresAt) || 0;
    accessTokenRef.current = data.token;
    refreshTokenRef.current = isWeb ? null : data.refreshToken;
    accessExpiryRef.current = expiresAt;
    setToken(data.token);
    setUser(data.user);

    await Promise.all([
      tokenStorage.setItemAsync(ACCESS_TOKEN_KEY, data.token),
      ...(isWeb ? [] : [tokenStorage.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken)]),
      tokenStorage.setItemAsync(ACCESS_EXPIRY_KEY, String(expiresAt)),
      tokenStorage.deleteItemAsync(LEGACY_TOKEN_KEY),
    ]);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const refreshToken = isWeb
      ? null
      : refreshTokenRef.current ||
        await tokenStorage.getItemAsync(REFRESH_TOKEN_KEY);
    if (!isWeb && !refreshToken) return null;

    refreshInFlightRef.current = authApi
      .post(
        API_ROUTES.auth.refresh,
        isWeb ? undefined : { refreshToken }
      )
      .then(async ({ data }) => {
        await saveSession(data);
        return data.token;
      })
      .catch(async (error) => {
        const status = error.response?.status;
        if (
          error.code === 'INVALID_AUTH_RESPONSE' ||
          status === 401 ||
          status === 403
        ) {
          await clearSession();
        }
        return null;
      })
      .finally(() => {
        refreshInFlightRef.current = null;
      });

    return refreshInFlightRef.current;
  }, [clearSession, saveSession]);

  const getToken = useCallback(async () => {
    if (
      accessTokenRef.current &&
      accessExpiryRef.current > Date.now() + REFRESH_EARLY_MS
    ) {
      return accessTokenRef.current;
    }
    return refreshAccessToken();
  }, [refreshAccessToken]);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        if (isWeb) {
          await refreshAccessToken();
          return;
        }
        const [storedAccessToken, storedRefreshToken, storedExpiry] =
          await Promise.all([
            tokenStorage.getItemAsync(ACCESS_TOKEN_KEY),
            tokenStorage.getItemAsync(REFRESH_TOKEN_KEY),
            tokenStorage.getItemAsync(ACCESS_EXPIRY_KEY),
          ]);

        accessTokenRef.current = storedAccessToken;
        refreshTokenRef.current = storedRefreshToken;
        accessExpiryRef.current = Number(storedExpiry) || 0;

        if (
          storedAccessToken &&
          accessExpiryRef.current > Date.now() + REFRESH_EARLY_MS
        ) {
          const { data } = await authApi.get(API_ROUTES.auth.me, {
            headers: { Authorization: `Bearer ${storedAccessToken}` },
          });
          if (active && data?.success) {
            setToken(storedAccessToken);
            setUser(data.user);
            return;
          }
        }

        if (storedRefreshToken) {
          await refreshAccessToken();
        } else {
          await clearSession();
        }
      } catch {
        if (refreshTokenRef.current) {
          await refreshAccessToken();
        } else {
          await clearSession();
        }
      } finally {
        if (active) setIsLoaded(true);
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, [clearSession, refreshAccessToken]);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await authApi.post(API_ROUTES.auth.login, { email, password });
      if (isCompleteSession(data)) {
        await saveSession(data);
        return { success: true };
      }
      return { success: false, message: data?.message || 'Invalid login response' };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }, [saveSession]);

  const register = useCallback(async (userData) => {
    try {
      const { data } = await authApi.post(API_ROUTES.auth.register, userData);
      if (isCompleteSession(data)) {
        await saveSession(data);
        return { success: true };
      }
      return { success: false, message: data?.message || 'Invalid registration response' };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }, [saveSession]);

  const logout = useCallback(async () => {
    const refreshToken = refreshTokenRef.current;
    try {
      await authApi.post(
        API_ROUTES.auth.logout,
        isWeb ? undefined : { refreshToken }
      );
    } catch {
      // Local sign-out must still complete if the server is unavailable.
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const value = useMemo(() => ({
    user,
    token,
    isLoaded,
    getToken,
    login,
    register,
    logout,
  }), [getToken, isLoaded, login, logout, register, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return {
    isLoaded: context.isLoaded,
    getToken: context.getToken,
    userId: context.user?.id,
    user: context.user,
    isSignedIn: Boolean(context.user),
    signOut: context.logout,
    login: context.login,
    register: context.register,
  };
};
