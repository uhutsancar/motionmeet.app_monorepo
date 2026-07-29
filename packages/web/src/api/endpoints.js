import api from './axios';
import { API_ROUTES, createOperationId } from '@motionmeet/shared';

const withOperationId = (payload, prefix) => {
  const isFormData =
    typeof FormData !== 'undefined' && payload instanceof FormData;
  const existing =
    isFormData && typeof payload.get === 'function'
      ? payload.get('operationId')
      : payload?.operationId;
  const operationId =
    typeof existing === 'string' && existing ? existing : createOperationId(prefix);
  if (isFormData) {
    if (!existing) {
      if (typeof payload.set === 'function') payload.set('operationId', operationId);
      else payload.append('operationId', operationId);
    }
    return { payload, operationId };
  }
  return { payload: { ...(payload || {}), operationId }, operationId };
};

// USER
export const getUserData = async (token) => {
  const { data } = await api.get(API_ROUTES.user.data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const updateUser = async (userData, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.update, userData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getUserProfile = async (profileId, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.profiles, { profileId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const discoverUsers = async (input, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.discover, { input }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const followUser = async (userId, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.follow, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const unfollowUser = async (userId, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.unfollow, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const connectUser = async (userId, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.connect, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const acceptConnection = async (userId, token) => {
  const { data } = await api.post(API_ROUTES.user_extras.accept, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getConnections = async (token, section, cursor) => {
  const { data } = await api.get(API_ROUTES.user_extras.connections, {
    headers: { Authorization: `Bearer ${token}` },
    params: section
      ? { section, ...(cursor ? { cursor } : {}) }
      : undefined,
  });
  return data;
};

export const getRecentMessages = async (token) => {
  const { data } = await api.get(API_ROUTES.user_extras.recent_messages, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getSuggestedUsers = async (token) => {
  const { data } = await api.get(API_ROUTES.user_extras.suggested, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// MESSAGE
export const getConversations = async (token, cursor) => {
  const { data } = await api.get(API_ROUTES.message.conversations, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const getMessages = async (userId, token, cursor) => {
  const { data } = await api.post(API_ROUTES.message.get, { to_user_id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const sendMessage = async (messageData, token) => {
  const request = withOperationId(messageData, 'message');
  const { data } = await api.post(API_ROUTES.message.send, request.payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': request.operationId,
    }
  });
  return data;
};

export const markMessageSeen = async (fromUserId, token) => {
  const { data } = await api.post(API_ROUTES.message.seen, { from_user_id: fromUserId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const deleteMessage = async (messageId, token) => {
  const { data } = await api.delete(API_ROUTES.message.delete(messageId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// POST
export const getFeed = async (token, cursor, mode = 'discover') => {
  const { data } = await api.get(API_ROUTES.post.feed, {
    headers: { Authorization: `Bearer ${token}` },
    params: { ...(cursor ? { cursor } : {}), mode },
  });
  return data;
};

export const createPost = async (postData, token) => {
  const request = withOperationId(postData, 'post');
  const { data } = await api.post(API_ROUTES.post.add, request.payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': request.operationId,
    }
  });
  return data;
};

export const likePost = async (postId, token) => {
  const { data } = await api.post(API_ROUTES.post.like, { postId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const deletePost = async (postId, token) => {
  const { data } = await api.delete(API_ROUTES.post.delete(postId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const addComment = async (postId, content, token) => {
  const { data } = await api.post(API_ROUTES.post.comment, { postId, content }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};


// STORY
export const getStories = async (token, cursor) => {
  const { data } = await api.get(API_ROUTES.story.get, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const createStory = async (storyData, token) => {
  const request = withOperationId(storyData, 'story');
  const { data } = await api.post(API_ROUTES.story.create, request.payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': request.operationId,
    }
  });
  return data;
};

export const deleteStory = async (storyId, token) => {
  const { data } = await api.delete(API_ROUTES.story.delete(storyId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// WORKOUT
export const getWorkoutStats = async (period, token) => {
  const { data } = await api.get(API_ROUTES.workout.stats, {
    headers: { Authorization: `Bearer ${token}` },
    params: { period },
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
  const operationId = workoutData.operationId || createOperationId('workout');
  const { data } = await api.post(API_ROUTES.workout.base, { ...workoutData, operationId }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': operationId,
    }
  });
  return data;
};

// ROUTINE
export const getRoutines = async (token, cursor) => {
  const { data } = await api.get(API_ROUTES.routine.base, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const createRoutine = async (routineData, token) => {
  const operationId = routineData.operationId || createOperationId('routine');
  const { data } = await api.post(API_ROUTES.routine.base, { ...routineData, operationId }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': operationId,
    }
  });
  return data;
};

// EXERCISE
export const getExercises = async (params, token) => {
  const { data } = await api.get(API_ROUTES.exercise.base, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const createExercise = async (exerciseData, token) => {
  const { data } = await api.post(API_ROUTES.exercise.base, exerciseData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getExerciseStats = async (exerciseId, token) => {
  const { data } = await api.get(API_ROUTES.exercise.stats(exerciseId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// PLANS
export const getPlans = async (token) => {
  const { data } = await api.get(API_ROUTES.plan.base, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const updatePlan = async (planId, token) => {
  const { data } = await api.post(API_ROUTES.plan.update, { planId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// METADATA
export const getMuscleGroups = async (token) => {
  const { data } = await api.get(API_ROUTES.metadata.muscleGroups, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getEquipment = async (token) => {
  const { data } = await api.get(API_ROUTES.metadata.equipment, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};
