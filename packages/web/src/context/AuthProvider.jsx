import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { BASEURL } from '~/config/env';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [isLoaded, setIsLoaded] = useState(false);

  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const getToken = useCallback(async () => tokenRef.current, []);

  useEffect(() => {
    if (token) {
      axios.get(`${BASEURL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (res.data.success) {
          setUser(res.data.user);
        } else {
          setToken(null);
          localStorage.removeItem('token');
        }
      })
      .catch(err => {
        console.error('Failed to fetch user:', err);
        setToken(null);
        localStorage.removeItem('token');
      })
      .finally(() => setIsLoaded(true));
    } else {
      setIsLoaded(true);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${BASEURL}/api/auth/login`, { email, password });
      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('token', res.data.token);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
  };

  const register = async (userData) => {
    try {
      const res = await axios.post(`${BASEURL}/api/auth/register`, userData);
      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('token', res.data.token);
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || err.message };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoaded, login, register, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

// Legacy auth hooks to minimize rewrite
// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return {
    user: context.user,
    getToken: context.getToken,
    isLoaded: context.isLoaded,
    isSignedIn: !!context.user,
    userId: context.user?.id,
    signOut: context.logout,
    login: context.login,
    register: context.register
  };
};
