// Shared configuration exports
module.exports = {
  api: {
    baseURL: process.env.API_BASE_URL || 'http://localhost:5000',
    timeout: 10000,
  },
  app: {
    name: 'MotionMeet',
    version: '1.0.0',
  },
};

