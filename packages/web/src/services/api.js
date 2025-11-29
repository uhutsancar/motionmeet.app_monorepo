// API service for MotionMeet Web
// Shared configuration with mobile app

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  endpoints: {
    health: '/health',
    workouts: '/api/workouts',
    users: '/api/users',
    posts: '/api/posts',
    messages: '/api/messages',
    auth: {
      login: '/api/auth/login',
      register: '/api/auth/register',
      profile: '/api/auth/profile',
    },
  },
};

// Fetch-based API client
const apiClient = {
  async get(endpoint, options = {}) {
    const url = `${apiConfig.baseURL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  async post(endpoint, data, options = {}) {
    const url = `${apiConfig.baseURL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  async put(endpoint, data, options = {}) {
    const url = `${apiConfig.baseURL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  async delete(endpoint, options = {}) {
    const url = `${apiConfig.baseURL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
};

// API functions matching shared package endpoints
export const api = {
  // Health check
  checkHealth: () => apiClient.get(apiConfig.endpoints.health),

  // Auth endpoints
  login: (credentials) => apiClient.post(apiConfig.endpoints.auth.login, credentials),
  register: (userData) => apiClient.post(apiConfig.endpoints.auth.register, userData),
  getProfile: () => apiClient.get(apiConfig.endpoints.auth.profile),

  // Workouts endpoints
  getWorkouts: () => apiClient.get(apiConfig.endpoints.workouts),
  getWorkout: (id) => apiClient.get(`${apiConfig.endpoints.workouts}/${id}`),
  createWorkout: (data) => apiClient.post(apiConfig.endpoints.workouts, data),
  updateWorkout: (id, data) => apiClient.put(`${apiConfig.endpoints.workouts}/${id}`, data),
  deleteWorkout: (id) => apiClient.delete(`${apiConfig.endpoints.workouts}/${id}`),

  // Posts/Feed endpoints
  getPosts: () => apiClient.get(apiConfig.endpoints.posts),
  getPost: (id) => apiClient.get(`${apiConfig.endpoints.posts}/${id}`),
  createPost: (data) => apiClient.post(apiConfig.endpoints.posts, data),
  updatePost: (id, data) => apiClient.put(`${apiConfig.endpoints.posts}/${id}`, data),
  deletePost: (id) => apiClient.delete(`${apiConfig.endpoints.posts}/${id}`),

  // Users endpoints
  getUsers: () => apiClient.get(apiConfig.endpoints.users),
  getUser: (id) => apiClient.get(`${apiConfig.endpoints.users}/${id}`),
  updateUser: (id, data) => apiClient.put(`${apiConfig.endpoints.users}/${id}`, data),

  // Messages endpoints
  getMessages: () => apiClient.get(apiConfig.endpoints.messages),
  getMessage: (id) => apiClient.get(`${apiConfig.endpoints.messages}/${id}`),
  sendMessage: (data) => apiClient.post(apiConfig.endpoints.messages, data),
};

export { apiConfig, apiClient };
export default api;
