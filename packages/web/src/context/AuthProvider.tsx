import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import axios from "axios";
import api from "~/api/axios";
import { API_ROUTES, type ApiFailure, type AuthenticationResponse, type LoginInput, type RegistrationInput } from "@motionmeet/shared";
import { clearSessionState, store } from "~/app/store";

interface AuthActionResult { success: boolean; message?: string; fields?: Record<string, string> }
interface AuthContextValue {
  user: AuthenticationResponse["user"] | null;
  token: string | null;
  isLoaded: boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (userData: RegistrationInput) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
const REFRESH_SKEW_MS = 60_000;

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<AuthenticationResponse["user"] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef(0);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const applySession = useCallback((data: AuthenticationResponse): string | null => {
    const nextToken = data?.token || null;
    const nextExpiry = Number(data?.accessTokenExpiresAt) || 0;
    tokenRef.current = nextToken;
    expiresAtRef.current = nextExpiry;
    setToken(nextToken);
    setUser(data?.user || null);
    return nextToken;
  }, []);

  const clearSession = useCallback(() => {
    tokenRef.current = null;
    expiresAtRef.current = 0;
    setToken(null);
    setUser(null);
    store.dispatch(clearSessionState());
    localStorage.removeItem("token");
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = api
      .post<AuthenticationResponse>(API_ROUTES.auth.refresh)
      .then((response) => {
        if (!response.data?.success || !response.data?.token || !response.data?.user) {
          throw new Error("INVALID_AUTH_RESPONSE");
        }
        return applySession(response.data);
      })
      .catch((error: unknown) => {
        if (
          (error instanceof Error && error.message === "INVALID_AUTH_RESPONSE") ||
          (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403))
        ) {
          clearSession();
        }
        return null;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }, [applySession, clearSession]);

  const getToken = useCallback(async () => {
    if (
      tokenRef.current &&
      expiresAtRef.current > Date.now() + REFRESH_SKEW_MS
    ) {
      return tokenRef.current;
    }
    return refreshAccessToken();
  }, [refreshAccessToken]);

  useEffect(() => {
    localStorage.removeItem("token");
    refreshAccessToken().finally(() => setIsLoaded(true));
  }, [refreshAccessToken]);

  const login = async (email: LoginInput["email"], password: LoginInput["password"]): Promise<AuthActionResult> => {
    try {
      const response = await api.post<AuthenticationResponse>(API_ROUTES.auth.login, { email, password });
      if (!response.data?.success || !response.data?.token || !response.data?.user) {
        return { success: false, message: "Invalid login response" };
      }
      applySession(response.data);
      return { success: true };
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      return {
        success: false,
        message: failure?.message || failure?.error?.message || "Login failed",
      };
    }
  };

  const register = async (userData: RegistrationInput): Promise<AuthActionResult> => {
    try {
      const response = await api.post<AuthenticationResponse>(API_ROUTES.auth.register, userData);
      if (!response.data?.success || !response.data?.token || !response.data?.user) {
        return { success: false, message: "Invalid registration response" };
      }
      applySession(response.data);
      return { success: true };
    } catch (error: unknown) {
      const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
      return {
        success: false,
        message: failure?.message || failure?.error?.message || "Registration failed",
        fields: failure?.error?.fields,
      };
    }
  };

  const logout = useCallback(async () => {
    try {
      await api.post(API_ROUTES.auth.logout);
    } catch {
      // Local logout must still complete if the server is unreachable.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoaded, login, register, logout, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return {
    user: context.user,
    getToken: context.getToken,
    isLoaded: context.isLoaded,
    isSignedIn: Boolean(context.user),
    userId: context.user?.id,
    signOut: context.logout,
    login: context.login,
    register: context.register,
  };
};
