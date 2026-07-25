import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "~/api/axios";
import { API_ROUTES } from "@motionmeet/shared";

const AuthContext = createContext();
const REFRESH_SKEW_MS = 60_000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const tokenRef = useRef(null);
  const expiresAtRef = useRef(0);
  const refreshPromiseRef = useRef(null);

  const applySession = useCallback((data) => {
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
    localStorage.removeItem("token");
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = api
      .post(API_ROUTES.auth.refresh)
      .then((response) => {
        if (!response.data?.success || !response.data?.token || !response.data?.user) {
          throw Object.assign(new Error("Invalid refresh response"), {
            code: "INVALID_AUTH_RESPONSE",
          });
        }
        return applySession(response.data);
      })
      .catch((error) => {
        if (
          error.code === "INVALID_AUTH_RESPONSE" ||
          error.response?.status === 401 ||
          error.response?.status === 403
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

  const login = async (email, password) => {
    try {
      const response = await api.post(API_ROUTES.auth.login, { email, password });
      if (!response.data?.success || !response.data?.token || !response.data?.user) {
        return { success: false, message: "Invalid login response" };
      }
      applySession(response.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error?.message || "Login failed",
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post(API_ROUTES.auth.register, userData);
      if (!response.data?.success || !response.data?.token || !response.data?.user) {
        return { success: false, message: "Invalid registration response" };
      }
      applySession(response.data);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.response?.data?.error?.message || "Registration failed",
        fields: error.response?.data?.error?.fields,
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

// eslint-disable-next-line react-refresh/only-export-components
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
