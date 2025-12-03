import axios from 'axios';

const BASE_URL = __DEV__ 
  ? 'http://192.168.1.124:4000' // Development - Use your computer's IP
  : 'https://motionmeet-app.vercel.app'; // Production

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store token setter function
let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
};

// Request interceptor for adding auth token
api.interceptors.request.use(
  async (config) => {
    // Add Clerk auth token if available
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
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
