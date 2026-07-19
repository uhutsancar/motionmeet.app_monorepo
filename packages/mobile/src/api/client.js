import axios from 'axios';
import { API_URL } from '../config/environment';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
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
    // Ask Clerk for a current token on every request. Clerk serves its cached
    // token while valid and refreshes it when needed.
    const token = authTokenProvider ? await authTokenProvider() : authToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Handle multipart/form-data
    if (config.data instanceof FormData) {
      config.headers['Content-Type'] = 'multipart/form-data';
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
