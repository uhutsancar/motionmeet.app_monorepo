import api from './axios';

// USER
export const getUserData = async (token) => {
  const { data } = await api.get('/api/user/data', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const updateUser = async (userData, token) => {
  const { data } = await api.post('/api/user/update', userData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getUserProfile = async (profileId, token) => {
  const { data } = await api.post('/api/user/profiles', { profileId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const discoverUsers = async (input, token) => {
  const { data } = await api.post('/api/user/discover', { input }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const followUser = async (userId, token) => {
  const { data } = await api.post('/api/user/follow', { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const unfollowUser = async (userId, token) => {
  const { data } = await api.post('/api/user/unfollow', { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const connectUser = async (userId, token) => {
  const { data } = await api.post('/api/user/connect', { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const acceptConnection = async (userId, token) => {
  const { data } = await api.post('/api/user/accept', { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getConnections = async (token) => {
  const { data } = await api.get('/api/user/connections', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getRecentMessages = async (token) => {
  const { data } = await api.get('/api/user/recent-messages', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getSuggestedUsers = async (token) => {
  const { data } = await api.get('/api/user/suggested', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// MESSAGE
export const getConversations = async (token) => {
  const { data } = await api.get('/api/message/conversations', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getMessages = async (userId, token) => {
  const { data } = await api.post('/api/message/get', { to_user_id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const sendMessage = async (messageData, token) => {
  const { data } = await api.post('/api/message/send', messageData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const markMessageSeen = async (messageId, token) => {
  const { data } = await api.post('/api/message/seen', { id: messageId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const deleteMessage = async (messageId, token) => {
  const { data } = await api.delete(`/api/message/delete/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// POST
export const getFeed = async (token) => {
  const { data } = await api.get('/api/post/feed', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const createPost = async (postData, token) => {
  const { data } = await api.post('/api/post/add', postData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const likePost = async (postId, token) => {
  const { data } = await api.post('/api/post/like', { postId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const deletePost = async (postId, token) => {
  const { data } = await api.delete(`/api/post/delete/${postId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const addComment = async (postId, content, token) => {
  const { data } = await api.post('/api/post/comment/add', { postId, content }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};


// STORY
export const getStories = async (token) => {
  const { data } = await api.get('/api/story/get', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const createStory = async (storyData, token) => {
  const { data } = await api.post('/api/story/create', storyData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const deleteStory = async (storyId, token) => {
  const { data } = await api.delete(`/api/story/delete/${storyId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// WORKOUT
export const getWorkoutStats = async (period, token) => {
  const { data } = await api.get(`/api/workout/stats?period=${period}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getWorkouts = async (token, cursor) => {
  const { data } = await api.get('/api/workout', {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 100, ...(cursor ? { cursor } : {}) },
  });
  return data;
};

export const createWorkout = async (workoutData, token) => {
  const { data } = await api.post('/api/workout', workoutData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// ROUTINE
export const getRoutines = async (token, cursor) => {
  const { data } = await api.get('/api/routine', {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const createRoutine = async (routineData, token) => {
  const { data } = await api.post('/api/routine', routineData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// EXERCISE
export const getExercises = async (params, token) => {
  const { data } = await api.get('/api/exercise', {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const createExercise = async (exerciseData, token) => {
  const { data } = await api.post('/api/exercise', exerciseData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getExerciseStats = async (exerciseId, token) => {
  const { data } = await api.get(`/api/exercise/${exerciseId}/stats`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// PLANS
export const getPlans = async (token) => {
  const { data } = await api.get('/api/plans', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const updatePlan = async (planId, token) => {
  const { data } = await api.post('/api/plans/update', { planId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// METADATA
export const getMuscleGroups = async () => {
  const { data } = await api.get('/api/muscle-groups');
  return data;
};

export const getEquipment = async () => {
  const { data } = await api.get('/api/equipment');
  return data;
};
