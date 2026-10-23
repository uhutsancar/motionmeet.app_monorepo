import axios from 'axios';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '../config/environment';
import {
  API_ROUTES,
  type ApiFailure,
  type AuthenticationResponse,
  type RegistrationInput,
} from '@motionmeet/shared';
import { clearSessionState, store } from '../store/store';
import { clearShareCardCache } from '../utils/shareCardCache';

const ACCESS_TOKEN_KEY = 'motionmeet_access_token';
const REFRESH_TOKEN_KEY = 'motionmeet_refresh_token';
const ACCESS_EXPIRY_KEY = 'motionmeet_access_expiry';
const LEGACY_TOKEN_KEY = 'token';
const REFRESH_EARLY_MS = 60 * 1000;
const isWeb = Platform.OS === 'web';
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const isCompleteSession = (data: unknown): data is AuthenticationResponse => {
  if (!data || typeof data !== 'object') return false;
  const session = data as Partial<AuthenticationResponse>;
  return Boolean(
    session.success && session.token && (isWeb || session.refreshToken) && session.user
  );
};

const tokenStorage = {
  getItemAsync: async (key: string): Promise<string | null> => {
    if (isWeb) return null;
    return SecureStore.getItemAsync(key, secureStoreOptions);
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (isWeb) return;
    await SecureStore.setItemAsync(key, value, secureStoreOptions);
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    if (isWeb) return;
    await SecureStore.deleteItemAsync(key, secureStoreOptions);
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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
authApi.interceptors.request.use((request) => {
  const method = request.method?.toUpperCase();
  if (isWeb && method && !SAFE_METHODS.has(method)) {
    request.headers.set('X-CSRF-Protection', '1');
  }
  return request;
});

interface AuthActionResult { success: boolean; message?: string }
interface AuthContextValue {
  token: string | null;
  isLoaded: boolean;
  getToken: (options?: { skipCache?: boolean }) => Promise<string | null>;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (userData: RegistrationInput) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const accessExpiryRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    accessExpiryRef.current = 0;
    setToken(null);
    store.dispatch(clearSessionState());
    await Promise.all([
      tokenStorage.deleteItemAsync(ACCESS_TOKEN_KEY),
      tokenStorage.deleteItemAsync(REFRESH_TOKEN_KEY),
      tokenStorage.deleteItemAsync(ACCESS_EXPIRY_KEY),
      tokenStorage.deleteItemAsync(LEGACY_TOKEN_KEY),
    ]);
  }, []);

  const saveSession = useCallback(async (data: AuthenticationResponse) => {
    if (!isCompleteSession(data)) {
      throw Object.assign(new Error('Invalid authentication response'), {
        code: 'INVALID_AUTH_RESPONSE',
      });
    }

    const expiresAt = Number(data.accessTokenExpiresAt) || 0;
    accessTokenRef.current = data.token;
    refreshTokenRef.current = isWeb ? null : data.refreshToken ?? null;
    accessExpiryRef.current = expiresAt;
    setToken(data.token);

    await Promise.all([
      tokenStorage.setItemAsync(ACCESS_TOKEN_KEY, data.token),
      ...(isWeb || !data.refreshToken ? [] : [tokenStorage.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken)]),
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
      .post<AuthenticationResponse>(
        API_ROUTES.auth.refresh,
        isWeb ? undefined : { refreshToken }
      )
      .then(async ({ data }) => {
        await saveSession(data);
        return data.token;
      })
      .catch(async (error: unknown) => {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (
          (error instanceof Error && 'code' in error && error.code === 'INVALID_AUTH_RESPONSE') ||
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

  const getToken = useCallback(async (options?: { skipCache?: boolean }) => {
    if (options?.skipCache) return refreshAccessToken();
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
          // Token is still valid. Restore state immediately from the token
          // without blocking on a network round-trip so the UI becomes
          // interactive sooner. The /me call runs in the background to pull
          // fresh user data; if it returns 401/403 the session is cleared.
          setToken(storedAccessToken);
          if (active) setIsLoaded(true);
          return;
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


  const login = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    try {
      const { data } = await authApi.post<AuthenticationResponse | ApiFailure>(API_ROUTES.auth.login, { email, password });
      if (isCompleteSession(data)) {
        await saveSession(data);
        return { success: true };
      }
      return { success: false, message: data?.message || 'Invalid login response' };
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      return {
        success: false,
        message: failure?.message || (error instanceof Error ? error.message : 'Login failed'),
      };
    }
  }, [saveSession]);

  const register = useCallback(async (userData: RegistrationInput): Promise<AuthActionResult> => {
    try {
      const { data } = await authApi.post<AuthenticationResponse | ApiFailure>(API_ROUTES.auth.register, userData);
      if (isCompleteSession(data)) {
        await saveSession(data);
        return { success: true };
      }
      return { success: false, message: data?.message || 'Invalid registration response' };
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      return {
        success: false,
        message: failure?.message || (error instanceof Error ? error.message : 'Registration failed'),
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
      await clearShareCardCache();
    }
  }, [clearSession]);

  const value = useMemo(() => ({
    token,
    isLoaded,
    getToken,
    login,
    register,
    logout,
  }), [getToken, isLoaded, login, logout, register, token]);

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
    isSignedIn: Boolean(context.token),
    signOut: context.logout,
    login: context.login,
    register: context.register,
  };
};
