import axios from 'axios';
import { API_URL } from '../config/environment';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Store token setter function
let authToken = null;
let authTokenProvider = null;

export const setAuthToken = (token) => {
  authToken = token;
};

export const setAuthTokenProvider = (provider) => {
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

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle errors globally
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
