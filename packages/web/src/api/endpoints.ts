import api from './axios';
import {
  API_ROUTES,
  createOperationId,
  type Comment,
  type Conversation,
  type Exercise,
  type ExerciseStats,
  type Message,
  type Plan,
  type Post,
  type PublicUser,
  type Routine,
  type Story,
  type User,
  type UserProfile,
  type UserUpdateInput,
  type Workout,
  type WorkoutStats,
} from '@motionmeet/shared';

type Token = string;
type Cursor = string | null | undefined;
type OperationPayload = FormData | (Record<string, unknown> & { operationId?: string });
interface BasicResponse { success: boolean; message?: string }
interface UserResponse extends BasicResponse { user: User }
interface ProfileResponse extends BasicResponse { profile: UserProfile; posts: Post[]; nextCursor: string | null }
interface UsersResponse extends BasicResponse { users: PublicUser[] }
interface ConnectionsResponse extends BasicResponse { connections: PublicUser[]; pendingConnections: PublicUser[]; followers: PublicUser[]; following: PublicUser[]; items?: PublicUser[]; nextCursor?: string | null }
interface ConversationsResponse extends BasicResponse { conversations: Conversation[]; nextCursor: string | null }
interface MessagesResponse extends BasicResponse { messages: Message[]; nextCursor: string | null }
interface MessageResponse { success: boolean; message: Message; messageId?: string }
interface FeedResponse extends BasicResponse { posts: Post[]; nextCursor: string | null }
interface PostResponse extends BasicResponse { post: Post }
interface StoriesResponse extends BasicResponse { stories: Story[]; nextCursor: string | null }
interface StoryResponse extends BasicResponse { story: Story }
interface WorkoutsResponse extends BasicResponse { workouts: Workout[]; nextCursor: string | null }
interface WorkoutResponse extends BasicResponse { workout: Workout }
interface RoutinesResponse extends BasicResponse { routines: Routine[]; nextCursor: string | null }
interface RoutineResponse extends BasicResponse { routine: Routine }
interface ExercisesResponse extends BasicResponse { exercises: Exercise[]; total: number | null; nextCursor: string | null; limit: number; skip: number }
interface ExerciseResponse extends BasicResponse { exercise: Exercise }
interface ExerciseStatsResponse extends BasicResponse, ExerciseStats {}
interface PlansResponse extends BasicResponse { plans: Plan[] }
interface MetadataResponse extends BasicResponse { data: Array<{ code: string; name: string }> }

const withOperationId = (payload: OperationPayload, prefix: string): { payload: OperationPayload; operationId: string } => {
  if (typeof FormData !== 'undefined' && payload instanceof FormData) {
    const existing = payload.get('operationId');
    const operationId =
      typeof existing === 'string' && existing ? existing : createOperationId(prefix);
    if (!existing) payload.set('operationId', operationId);
    return { payload, operationId };
  }
  const objectPayload = payload as Record<string, unknown> & { operationId?: string };
  const existing = objectPayload.operationId;
  const operationId =
    typeof existing === 'string' && existing ? existing : createOperationId(prefix);
  return { payload: { ...objectPayload, operationId }, operationId };
};

// USER
export const getUserData = async (token: Token): Promise<UserResponse> => {
  const { data } = await api.get<UserResponse>(API_ROUTES.user.data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const updateUser = async (userData: UserUpdateInput | FormData, token: Token): Promise<UserResponse> => {
  const { data } = await api.post<UserResponse>(API_ROUTES.user_extras.update, userData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getUserProfile = async (profileId: string, token: Token): Promise<ProfileResponse> => {
  const { data } = await api.post<ProfileResponse>(API_ROUTES.user_extras.profiles, { profileId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const discoverUsers = async (input: string, token: Token): Promise<UsersResponse> => {
  const { data } = await api.post<UsersResponse>(API_ROUTES.user_extras.discover, { input }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const followUser = async (userId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post<BasicResponse>(API_ROUTES.user_extras.follow, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const unfollowUser = async (userId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post<BasicResponse>(API_ROUTES.user_extras.unfollow, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const connectUser = async (userId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post<BasicResponse>(API_ROUTES.user_extras.connect, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const acceptConnection = async (userId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post<BasicResponse>(API_ROUTES.user_extras.accept, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getConnections = async (token: Token, section?: string | null, cursor?: Cursor): Promise<ConnectionsResponse> => {
  const { data } = await api.get<ConnectionsResponse>(API_ROUTES.user_extras.connections, {
    headers: { Authorization: `Bearer ${token}` },
    params: section
      ? { section, ...(cursor ? { cursor } : {}) }
      : undefined,
  });
  return data;
};

export const getRecentMessages = async (token: Token): Promise<MessagesResponse> => {
  const { data } = await api.get<MessagesResponse>(API_ROUTES.user_extras.recent_messages, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getSuggestedUsers = async (token: Token): Promise<UsersResponse> => {
  const { data } = await api.get<UsersResponse>(API_ROUTES.user_extras.suggested, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// MESSAGE
export const getConversations = async (token: Token, cursor?: Cursor): Promise<ConversationsResponse> => {
  const { data } = await api.get<ConversationsResponse>(API_ROUTES.message.conversations, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const getMessages = async (userId: string, token: Token, cursor?: Cursor): Promise<MessagesResponse> => {
  const { data } = await api.post<MessagesResponse>(API_ROUTES.message.get, { to_user_id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const sendMessage = async (messageData: OperationPayload, token: Token): Promise<MessageResponse> => {
  const request = withOperationId(messageData, 'message');
  const { data } = await api.post<MessageResponse>(API_ROUTES.message.send, request.payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': request.operationId,
    }
  });
  return data;
};

export const markMessageSeen = async (fromUserId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post<BasicResponse>(API_ROUTES.message.seen, { from_user_id: fromUserId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const deleteMessage = async (messageId: string, token: Token): Promise<BasicResponse & { messageId?: string }> => {
  const { data } = await api.delete<BasicResponse & { messageId?: string }>(API_ROUTES.message.delete(messageId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// POST
export const getFeed = async (token: Token, cursor?: Cursor, mode: "discover" | "following" = 'discover'): Promise<FeedResponse> => {
  const { data } = await api.get<FeedResponse>(API_ROUTES.post.feed, {
    headers: { Authorization: `Bearer ${token}` },
    params: { ...(cursor ? { cursor } : {}), mode },
  });
  return data;
};

export const createPost = async (postData: OperationPayload, token: Token): Promise<PostResponse> => {
  const request = withOperationId(postData, 'post');
  const { data } = await api.post<PostResponse>(API_ROUTES.post.add, request.payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': request.operationId,
    }
  });
  return data;
};

export const likePost = async (postId: string, token: Token): Promise<BasicResponse & { liked?: boolean; like_count?: number }> => {
  const { data } = await api.post<BasicResponse & { liked?: boolean; like_count?: number }>(API_ROUTES.post.like, { postId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const deletePost = async (postId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.delete<BasicResponse>(API_ROUTES.post.delete(postId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const addComment = async (postId: string, content: string, token: Token): Promise<BasicResponse & { comment?: Comment; comment_count?: number }> => {
  const { data } = await api.post<BasicResponse & { comment?: Comment; comment_count?: number }>(API_ROUTES.post.comment, { postId, content }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};


// STORY
export const getStories = async (token: Token, cursor?: Cursor): Promise<StoriesResponse> => {
  const { data } = await api.get<StoriesResponse>(API_ROUTES.story.get, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const createStory = async (storyData: OperationPayload, token: Token): Promise<StoryResponse> => {
  const request = withOperationId(storyData, 'story');
  const { data } = await api.post<StoryResponse>(API_ROUTES.story.create, request.payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': request.operationId,
    }
  });
  return data;
};

export const deleteStory = async (storyId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.delete<BasicResponse>(API_ROUTES.story.delete(storyId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// WORKOUT
export const getWorkoutStats = async (period: "week" | "month" | "calendar_month" | "year", token: Token): Promise<WorkoutStats & BasicResponse> => {
  const { data } = await api.get<WorkoutStats & BasicResponse>(API_ROUTES.workout.stats, {
    headers: { Authorization: `Bearer ${token}` },
    params: { period },
  });
  return data;
};

export const getWorkouts = async (token: Token, cursor?: Cursor): Promise<WorkoutsResponse> => {
  const { data } = await api.get<WorkoutsResponse>(API_ROUTES.workout.base, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 100, ...(cursor ? { cursor } : {}) },
  });
  return data;
};

export const createWorkout = async <T extends object & { operationId?: string }>(workoutData: T, token: Token): Promise<WorkoutResponse> => {
  const operationId = workoutData.operationId || createOperationId('workout');
  const { data } = await api.post<WorkoutResponse>(API_ROUTES.workout.base, { ...workoutData, operationId }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': operationId,
    }
  });
  return data;
};

// ROUTINE
export const getRoutines = async (token: Token, cursor?: Cursor): Promise<RoutinesResponse> => {
  const { data } = await api.get<RoutinesResponse>(API_ROUTES.routine.base, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const createRoutine = async (routineData: Record<string, unknown> & { operationId?: string }, token: Token): Promise<RoutineResponse> => {
  const operationId = routineData.operationId || createOperationId('routine');
  const { data } = await api.post<RoutineResponse>(API_ROUTES.routine.base, { ...routineData, operationId }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': operationId,
    }
  });
  return data;
};

// EXERCISE
export const getExercises = async (params: Record<string, string | number | boolean | undefined>, token: Token): Promise<ExercisesResponse> => {
  const { data } = await api.get<ExercisesResponse>(API_ROUTES.exercise.base, {
    params,
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const createExercise = async (exerciseData: Record<string, unknown>, token: Token): Promise<ExerciseResponse> => {
  const { data } = await api.post<ExerciseResponse>(API_ROUTES.exercise.base, exerciseData, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getExerciseStats = async (exerciseId: string, token: Token): Promise<ExerciseStatsResponse> => {
  const { data } = await api.get<ExerciseStatsResponse>(API_ROUTES.exercise.stats(exerciseId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// PLANS
export const getPlans = async (token: Token): Promise<PlansResponse> => {
  const { data } = await api.get<PlansResponse>(API_ROUTES.plan.base, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const updatePlan = async (planId: string, token: Token): Promise<UserResponse> => {
  const { data } = await api.post<UserResponse>(API_ROUTES.plan.update, { planId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// METADATA
export const getMuscleGroups = async (token: Token): Promise<MetadataResponse> => {
  const { data } = await api.get<MetadataResponse>(API_ROUTES.metadata.muscleGroups, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getEquipment = async (token: Token): Promise<MetadataResponse> => {
  const { data } = await api.get<MetadataResponse>(API_ROUTES.metadata.equipment, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};
