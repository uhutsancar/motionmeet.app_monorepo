import api from './client';

// ============= USER APIs =============
export const getUserData = async (token) => {
  const { data } = await api.get('/api/user/data', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const updateUserProfile = async (userData, token) => {
  const isFormData = userData && typeof userData.append === 'function';
  const { data } = await api.post('/api/user/update', userData, {
    headers: { 
      Authorization: `Bearer ${token}`,
      ...(isFormData ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' }),
    },
  });
  return data;
};

export const getUserProfile = async (profileId, token) => {
  const { data } = await api.post('/api/user/profiles', { profileId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const discoverUsers = async (input, token) => {
  const { data } = await api.post('/api/user/discover', { input }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const followUser = async (userId, token) => {
  const { data } = await api.post('/api/user/follow', { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const unfollowUser = async (userId, token) => {
  const { data } = await api.post('/api/user/unfollow', { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const sendConnectionRequest = async (userId, token) => {
  const { data } = await api.post('/api/user/connect', { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const acceptConnectionRequest = async (userId, token) => {
  const { data } = await api.post('/api/user/accept', { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getUserConnections = async (token) => {
  const { data } = await api.get('/api/user/connections', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getUserRecentMessages = async (token) => {
  const { data } = await api.get('/api/user/recent-messages', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getUserConversations = async (token) => {
  const { data } = await api.get('/api/message/conversations', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= POST APIs =============
export const getPosts = async (token) => {
  const { data } = await api.get('/api/post/feed', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const createPost = async (postData, token) => {
  const { data } = await api.post('/api/post/add', postData, {
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

export const likePost = async (postId, token) => {
  const { data } = await api.post('/api/post/like', { postId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const deletePost = async (postId, token) => {
  const { data } = await api.delete(`/api/post/delete/${postId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= MESSAGE APIs =============
export const getMessages = async (userId, token) => {
  const { data } = await api.post('/api/message/get', { to_user_id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const sendMessage = async (messageData, token) => {
  const { data } = await api.post('/api/message/send', messageData, {
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

export const deleteMessage = async (messageId, token) => {
  const { data } = await api.delete(`/api/message/delete/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= STORY APIs =============
export const getStories = async (token) => {
  const { data } = await api.get('/api/story/get', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const createStory = async (storyData, token) => {
  const { data } = await api.post('/api/story/create', storyData, {
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

export const deleteStory = async (storyId, token) => {
  const { data } = await api.delete(`/api/story/delete/${storyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= WORKOUT APIs =============
export const getWorkoutStats = async (period, token) => {
  const { data } = await api.get(`/api/workout/stats?period=${period}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getWorkouts = async (token) => {
  const { data } = await api.get('/api/workout', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const createWorkout = async (workoutData, token) => {
  const { data } = await api.post('/api/workout', workoutData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= ROUTINE APIs =============
export const getRoutines = async (token) => {
  const { data } = await api.get('/api/routine', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const createRoutine = async (routineData, token) => {
  const { data } = await api.post('/api/routine', routineData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= EXERCISE APIs =============
export const getExercises = async (params, token) => {
  const { data } = await api.get('/api/exercise', {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const createExercise = async (exerciseData, token) => {
  const { data } = await api.post('/api/exercise', exerciseData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getExerciseStats = async (exerciseId, token) => {
  const { data } = await api.get(`/api/exercise/${exerciseId}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= PLAN APIs =============
export const getPlans = async (token) => {
  const { data } = await api.get('/api/plans', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const updatePlan = async (planId, token) => {
  const { data } = await api.post('/api/plans/update', { planId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= ADDITIONAL APIs =============
export const addComment = async (postId, content, token) => {
  const { data } = await api.post('/api/post/comment/add', { postId, content }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getSuggestedUsers = async (token) => {
  const { data } = await api.get('/api/user/suggested', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export default {
  // User
  getUserData,
  updateUserProfile,
  getUserProfile,
  discoverUsers,
  followUser,
  unfollowUser,
  sendConnectionRequest,
  acceptConnectionRequest,
  getUserConnections,
  getUserRecentMessages,
  getUserConversations,
  
  // Post
  getPosts,
  createPost,
  likePost,
  deletePost,
  
  // Message
  getMessages,
  sendMessage,
  deleteMessage,
  
  // Story
  getStories,
  createStory,
  deleteStory,

  // Workout
  getWorkoutStats,
  getWorkouts,
  createWorkout,

  // Routine
  getRoutines,
  createRoutine,

  // Exercise
  getExercises,
  createExercise,
  getExerciseStats,

  // Plan
  getPlans,
  updatePlan,

  // Post Extras
  addComment,

  // User Extras
  getSuggestedUsers,
};
