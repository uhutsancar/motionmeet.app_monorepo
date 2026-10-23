import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '../config/environment';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Store token setter function
let authToken: string | null = null;
let authTokenProvider: (() => Promise<string | null>) | null = null;

export const setAuthToken = (token: string | null): void => {
  authToken = token;
};

export const setAuthTokenProvider = (provider: (() => Promise<string | null>) | null): void => {
  authTokenProvider = typeof provider === 'function' ? provider : null;
  if (!authTokenProvider) authToken = null;
};

// Request interceptor for adding auth token
api.interceptors.request.use(
  async (config) => {
    // Fetch current token before request.
    const token = authTokenProvider ? await authTokenProvider() : authToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const isFormData =
      typeof FormData !== 'undefined' &&
      config.data instanceof FormData;
    if (isFormData) {
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
      } else {
        delete config.headers['Content-Type'];
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

type RetriableConfig = InternalAxiosRequestConfig & { retryCount?: number };

const NETWORK_RETRIES = 2;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    /*
     * A read that never reached the server is tried again, twice, before the
     * screen hears about it. Tab screens load once when they are first built;
     * a request that fell into a dropped connection at that moment used to
     * leave the exercise catalogue "empty" until the app was restarted. Only
     * GETs are retried, and only when there was no response at all, so a
     * write is never sent twice and a real error from the server still
     * reaches the screen at once.
     */
    const config = error.config as RetriableConfig | undefined;
    const retryCount = config?.retryCount ?? 0;
    if (
      config
      && (config.method ?? 'get').toLowerCase() === 'get'
      && error.code === 'ERR_NETWORK'
      && !error.response
      && retryCount < NETWORK_RETRIES
    ) {
      config.retryCount = retryCount + 1;
      await wait(600 * (retryCount + 1) ** 2);
      return api(config);
    }
    // Expected request failures are handled by the calling screen. Logging
    // them with console.error opens React Native's LogBox over the user UI.
    return Promise.reject(error);
  }
);

export default api;
