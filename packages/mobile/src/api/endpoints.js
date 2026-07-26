import api from './client';
import { API_ROUTES } from '@motionmeet/shared';

// ============= USER APIs =============
export const getUserData = async (token) => {
  const { data } = await api.get(API_ROUTES.user.data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const updateUserProfile = async (userData, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.update, userData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getUserProfile = async (profileId, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.profiles, { profileId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const discoverUsers = async (input, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.discover, { input }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const followUser = async (userId, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.follow, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const unfollowUser = async (userId, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.unfollow, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const sendConnectionRequest = async (userId, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.connect, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const acceptConnectionRequest = async (userId, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.accept, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getUserConnections = async (token) => {
  const { data } = await api.get(API_ROUTES.user_extras.connections, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getUserRecentMessages = async (token) => {
  const { data } = await api.get(API_ROUTES.user_extras.recent_messages, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getUserConversations = async (token) => {
  const { data } = await api.get(API_ROUTES.message.conversations, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= POST APIs =============
export const getPosts = async (token, cursor, mode = 'discover') => {
  const { data } = await api.get(API_ROUTES.post.feed, {
    headers: { Authorization: `Bearer ${token}` },
    params: { ...(cursor ? { cursor } : {}), mode },
  });
  return data;
};

export const createPost = async (postData, token) => {
  const { data } = await api.post(API_ROUTES.post.add, postData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const likePost = async (postId, token) => {
  const { data } = await api.post(API_ROUTES.post.like, { postId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const deletePost = async (postId, token) => {
  const { data } = await api.delete(API_ROUTES.post.delete(postId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= MESSAGE APIs =============
export const getMessages = async (userId, token, cursor) => {
  const { data } = await api.post(API_ROUTES.message.get, { to_user_id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const sendMessage = async (messageData, token) => {
  const { data } = await api.post(API_ROUTES.message.send, messageData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const deleteMessage = async (messageId, token) => {
  const { data } = await api.delete(API_ROUTES.message.delete(messageId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= STORY APIs =============
export const getStories = async (token) => {
  const { data } = await api.get(API_ROUTES.story.get, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const createStory = async (storyData, token) => {
  const { data } = await api.post(API_ROUTES.story.create, storyData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const deleteStory = async (storyId, token) => {
  const { data } = await api.delete(API_ROUTES.story.delete(storyId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= WORKOUT APIs =============
export const getWorkoutStats = async (period, token) => {
  const { data } = await api.get(API_ROUTES.workout.stats, {
    headers: { Authorization: `Bearer ${token}` },
    params: { period }
  });
  return data;
};

export const getWorkouts = async (token, cursor) => {
  const { data } = await api.get(API_ROUTES.workout.base, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 100, ...(cursor ? { cursor } : {}) },
  });
  return data;
};

export const createWorkout = async (workoutData, token) => {
  const { data } = await api.post(API_ROUTES.workout.base, workoutData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= ROUTINE APIs =============
export const getRoutines = async (token, cursor) => {
  const { data } = await api.get(API_ROUTES.routine.base, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const createRoutine = async (routineData, token) => {
  const { data } = await api.post(API_ROUTES.routine.base, routineData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= EXERCISE APIs =============
export const getExercises = async (params, token) => {
  const { data } = await api.get(API_ROUTES.exercise.base, {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const createExercise = async (exerciseData, token) => {
  const { data } = await api.post(API_ROUTES.exercise.base, exerciseData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getExerciseStats = async (exerciseId, token) => {
  const { data } = await api.get(API_ROUTES.exercise.stats(exerciseId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getPersonalRecords = async (token) => {
  const { data } = await api.get(API_ROUTES.exercise.records, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= PLAN APIs =============
export const getPlans = async (token) => {
  const { data } = await api.get(API_ROUTES.plan.base, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const updatePlan = async (planId, token) => {
  const { data } = await api.post(API_ROUTES.plan.update, { planId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= ADDITIONAL APIs =============
export const addComment = async (postId, content, token) => {
  const { data } = await api.post(API_ROUTES.post.comment, { postId, content }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getPostComments = async (postId, token, cursor) => {
  const { data } = await api.get(API_ROUTES.post.comments(postId), {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const getSuggestedUsers = async (token) => {
  const { data } = await api.get(API_ROUTES.user_extras.suggested, {
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
  getPersonalRecords,

  // Plan
  getPlans,
  updatePlan,

  // Post Extras
  addComment,
  getPostComments,

  // User Extras
  getSuggestedUsers,
};
