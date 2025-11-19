// API utilities
const apiClient = require('./client');

module.exports = {
  client: apiClient,
  // API endpoints
  endpoints: {
    workouts: '/api/workouts',
    users: '/api/users',
    posts: '/api/posts',
    messages: '/api/messages',
  },
};

