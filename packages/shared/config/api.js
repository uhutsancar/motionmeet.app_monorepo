// API configuration
module.exports = {
  baseURL: process.env.API_BASE_URL || 'http://localhost:5000',
  timeout: 10000,
  endpoints: {
    workouts: '/api/workouts',
    users: '/api/users',
    posts: '/api/posts',
    messages: '/api/messages',
  },
};

