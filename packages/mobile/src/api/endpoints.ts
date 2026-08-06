import api from './client';
import {
  API_ROUTES,
  createOperationId,
  type Comment,
  type ApiFailure,
  type BodyMeasurement,
  type BodyMeasurementValues,
  type Conversation,
  type Exercise,
  type ExerciseSessionEntry,
  type ExerciseStats,
  type Message,
  type PersonalRecord,
  type Plan,
  type Post,
  type PublicUser,
  type Routine,
  type Story,
  type StoryViewer,
  type User,
  type UserProfile,
  type Workout,
  type WorkoutStats,
} from '@motionmeet/shared';

type Token = string;
type Cursor = string | null | undefined;
type OperationPayload = FormData | (Record<string, unknown> & { operationId?: string });
interface BasicResponse { success: boolean; message?: string }
interface UserResponse extends BasicResponse { user: User }
interface MeasurementsResponse extends BasicResponse { measurements: BodyMeasurement[] }
interface MeasurementResponse extends BasicResponse { measurement: BodyMeasurement }
interface ProfileResponse extends BasicResponse { profile: UserProfile; posts: Post[]; nextCursor: string | null }
interface UsersResponse extends BasicResponse { users: PublicUser[] }
interface ConnectionsResponse extends BasicResponse { connections: PublicUser[]; pendingConnections: PublicUser[]; followers: PublicUser[]; following: PublicUser[]; items?: PublicUser[]; nextCursor?: string | null }
interface ConversationsResponse extends BasicResponse { conversations: Conversation[]; nextCursor: string | null }
interface MessagesResponse extends BasicResponse { messages: Message[]; nextCursor: string | null }
type MessageResponse = { success: true; message: Message; messageId?: string } | ApiFailure;
interface FeedResponse extends BasicResponse { posts: Post[]; nextCursor: string | null }
interface PostResponse extends BasicResponse { post: Post }
interface CommentsResponse extends BasicResponse { comments: Comment[]; nextCursor: string | null }
interface StoriesResponse extends BasicResponse { stories: Story[]; nextCursor: string | null }
interface StoryResponse extends BasicResponse { story: Story }
interface WorkoutsResponse extends BasicResponse { workouts: Workout[]; nextCursor: string | null }
interface WorkoutResponse extends BasicResponse { workout: Workout }
interface RoutinesResponse extends BasicResponse { routines: Routine[]; nextCursor: string | null }
interface RoutineResponse extends BasicResponse { routine: Routine }
interface ExercisesResponse extends BasicResponse { exercises: Exercise[]; total: number | null; nextCursor: string | null; limit: number; skip: number }
interface ExerciseResponse extends BasicResponse { exercise: Exercise }
interface ExerciseStatsResponse extends BasicResponse, ExerciseStats {}
interface ExerciseHistoryResponse extends BasicResponse { history: ExerciseSessionEntry[] }
interface StoryViewersResponse extends BasicResponse { viewers: StoryViewer[] }
interface RecordsResponse extends BasicResponse { records: PersonalRecord[] }
interface PlansResponse extends BasicResponse { plans: Plan[] }
interface LikeResponse extends BasicResponse { liked: boolean; like_count: number }
interface CommentResponse extends BasicResponse { comment: Comment; comment_count: number }

const withOperationId = (payload: OperationPayload, prefix: string): { payload: OperationPayload; operationId: string } => {
  if (typeof FormData !== 'undefined' && payload instanceof FormData) {
    const existing = payload.get('operationId');
    const operationId = typeof existing === 'string' && existing ? existing : createOperationId(prefix);
    if (!existing) payload.append('operationId', operationId);
    return { payload, operationId };
  }
  const objectPayload = payload as Record<string, unknown> & { operationId?: string };
  const existing = objectPayload.operationId;
  const operationId =
    typeof existing === 'string' && existing ? existing : createOperationId(prefix);
  return { payload: { ...objectPayload, operationId }, operationId };
};

// ============= USER APIs =============
export const getUserData = async (token: Token): Promise<UserResponse> => {
  const { data } = await api.get(API_ROUTES.user.data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const updateUserProfile = async (userData: FormData | Record<string, unknown>, token: Token): Promise<UserResponse> => {
  const { data } = await api.post(API_ROUTES.user_extras.update, userData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getUserProfile = async (profileId: string, token: Token): Promise<ProfileResponse> => {
  const { data } = await api.post(API_ROUTES.user_extras.profiles, { profileId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const discoverUsers = async (input: string, token: Token): Promise<UsersResponse> => {
  const { data } = await api.post(API_ROUTES.user_extras.discover, { input }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const followUser = async (userId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post(API_ROUTES.user_extras.follow, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const unfollowUser = async (userId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post(API_ROUTES.user_extras.unfollow, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const sendConnectionRequest = async (userId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post(API_ROUTES.user_extras.connect, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const acceptConnectionRequest = async (userId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post(API_ROUTES.user_extras.accept, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getUserConnections = async (token: Token, section?: string | null, cursor?: Cursor): Promise<ConnectionsResponse> => {
  const { data } = await api.get(API_ROUTES.user_extras.connections, {
    headers: { Authorization: `Bearer ${token}` },
    params: section
      ? { section, ...(cursor ? { cursor } : {}) }
      : undefined,
  });
  return data;
};

export const getUserRecentMessages = async (token: Token): Promise<MessagesResponse> => {
  const { data } = await api.get(API_ROUTES.user_extras.recent_messages, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getUserConversations = async (token: Token, cursor?: Cursor): Promise<ConversationsResponse> => {
  const { data } = await api.get(API_ROUTES.message.conversations, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

// ============= POST APIs =============
export const getPosts = async (token: Token, cursor?: Cursor, mode: 'discover' | 'following' = 'discover'): Promise<FeedResponse> => {
  const { data } = await api.get(API_ROUTES.post.feed, {
    headers: { Authorization: `Bearer ${token}` },
    params: { ...(cursor ? { cursor } : {}), mode },
  });
  return data;
};

export const createPost = async (postData: OperationPayload, token: Token): Promise<PostResponse> => {
  const request = withOperationId(postData, 'post');
  const { data } = await api.post(API_ROUTES.post.add, request.payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': request.operationId,
    },
  });
  return data;
};

/** @deprecated Use likePostIdempotent / unlikePostIdempotent instead */
export const likePost = async (postId: string, token: Token): Promise<LikeResponse> => {
  const { data } = await api.post(API_ROUTES.post.like, { postId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const likePostIdempotent = async (postId: string, token: Token): Promise<LikeResponse> => {
  const { data } = await api.put(API_ROUTES.post.likeIdempotent(postId), null, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const unlikePostIdempotent = async (postId: string, token: Token): Promise<LikeResponse> => {
  const { data } = await api.delete(API_ROUTES.post.unlike(postId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const deletePost = async (postId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.delete(API_ROUTES.post.delete(postId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= MESSAGE APIs =============
export const getMessages = async (userId: string, token: Token, cursor?: Cursor): Promise<MessagesResponse> => {
  const { data } = await api.post(API_ROUTES.message.get, { to_user_id: userId }, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const sendMessage = async (messageData: OperationPayload, token: Token): Promise<MessageResponse> => {
  const request = withOperationId(messageData, 'message');
  const { data } = await api.post(API_ROUTES.message.send, request.payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': request.operationId,
    },
  });
  return data;
};

export const deleteMessage = async (messageId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.delete(API_ROUTES.message.delete(messageId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const markMessageSeen = async (fromUserId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post(
    API_ROUTES.message.seen,
    { from_user_id: fromUserId },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};

// ============= STORY APIs =============
export const getStories = async (token: Token): Promise<StoriesResponse> => {
  const { data } = await api.get(API_ROUTES.story.get, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const createStory = async (storyData: OperationPayload, token: Token): Promise<StoryResponse> => {
  const request = withOperationId(storyData, 'story');
  const { data } = await api.post(API_ROUTES.story.create, request.payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': request.operationId,
    },
  });
  return data;
};

export const deleteStory = async (storyId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.delete(API_ROUTES.story.delete(storyId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const markStoryViewed = async (storyId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post(API_ROUTES.story.view(storyId), {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getStoryViewers = async (storyId: string, token: Token): Promise<StoryViewersResponse> => {
  const { data } = await api.get(API_ROUTES.story.viewers(storyId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= MEASUREMENT APIs =============
export interface SaveMeasurementPayload extends BodyMeasurementValues {
  /** Calendar day as YYYY-MM-DD; the backend upserts on this day. */
  measuredOn: string;
  note?: string;
}

export const getMeasurements = async (token: Token, limit?: number): Promise<MeasurementsResponse> => {
  const { data } = await api.get(API_ROUTES.measurement.base, {
    headers: { Authorization: `Bearer ${token}` },
    params: limit ? { limit } : undefined,
  });
  return data;
};

export const saveMeasurement = async (payload: SaveMeasurementPayload, token: Token): Promise<MeasurementResponse> => {
  const { data } = await api.post(API_ROUTES.measurement.base, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const deleteMeasurement = async (measurementId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.delete(API_ROUTES.measurement.byId(measurementId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= WORKOUT APIs =============
export const getWorkoutStats = async (period: 'week' | 'month' | 'calendar_month' | 'year', token: Token): Promise<WorkoutStats & BasicResponse> => {
  const { data } = await api.get(API_ROUTES.workout.stats, {
    headers: { Authorization: `Bearer ${token}` },
    params: { period }
  });
  return data;
};

export const getWorkouts = async (token: Token, cursor?: Cursor): Promise<WorkoutsResponse> => {
  const { data } = await api.get(API_ROUTES.workout.base, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 100, ...(cursor ? { cursor } : {}) },
  });
  return data;
};

export const createWorkout = async <T extends object & { operationId?: string }>(workoutData: T, token: Token): Promise<WorkoutResponse> => {
  const operationId = workoutData.operationId || createOperationId('workout');
  const { data } = await api.post(API_ROUTES.workout.base, { ...workoutData, operationId }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': operationId,
    },
  });
  return data;
};

// ============= ROUTINE APIs =============
export const getRoutines = async (token: Token, cursor?: Cursor): Promise<RoutinesResponse> => {
  const { data } = await api.get(API_ROUTES.routine.base, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const createRoutine = async (routineData: Record<string, unknown> & { operationId?: string }, token: Token): Promise<RoutineResponse> => {
  const operationId = routineData.operationId || createOperationId('routine');
  const { data } = await api.post(API_ROUTES.routine.base, { ...routineData, operationId }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': operationId,
    },
  });
  return data;
};

// ============= EXERCISE APIs =============
export const getExercises = async (params: Record<string, string | number | boolean | undefined>, token: Token): Promise<ExercisesResponse> => {
  const { data } = await api.get(API_ROUTES.exercise.base, {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const createExercise = async (exerciseData: Record<string, unknown>, token: Token): Promise<ExerciseResponse> => {
  const { data } = await api.post(API_ROUTES.exercise.base, exerciseData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getExerciseStats = async (exerciseId: string, token: Token): Promise<ExerciseStatsResponse> => {
  const { data } = await api.get(API_ROUTES.exercise.stats(exerciseId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getExerciseHistory = async (exerciseId: string, token: Token, limit?: number): Promise<ExerciseHistoryResponse> => {
  const { data } = await api.get(API_ROUTES.exercise.history(exerciseId), {
    headers: { Authorization: `Bearer ${token}` },
    params: limit ? { limit } : undefined,
  });
  return data;
};

export const getPersonalRecords = async (token: Token): Promise<RecordsResponse> => {
  const { data } = await api.get(API_ROUTES.exercise.records, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= PLAN APIs =============
export const getPlans = async (token: Token): Promise<PlansResponse> => {
  const { data } = await api.get(API_ROUTES.plan.base, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const updatePlan = async (planId: string, token: Token): Promise<UserResponse> => {
  const { data } = await api.post(API_ROUTES.plan.update, { planId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// ============= ADDITIONAL APIs =============
export const addComment = async (postId: string, content: string, token: Token): Promise<CommentResponse> => {
  const { data } = await api.post(API_ROUTES.post.comment, { postId, content }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getPostComments = async (postId: string, token: Token, cursor?: Cursor): Promise<CommentsResponse> => {
  const { data } = await api.get(API_ROUTES.post.comments(postId), {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const getSuggestedUsers = async (token: Token): Promise<UsersResponse> => {
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
  likePostIdempotent,
  unlikePostIdempotent,
  deletePost,
  
  // Message
  getMessages,
  sendMessage,
  deleteMessage,
  markMessageSeen,
  
  // Story
  getStories,
  createStory,
  deleteStory,
  markStoryViewed,
  getStoryViewers,

  // Measurement
  getMeasurements,
  saveMeasurement,
  deleteMeasurement,

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
  getExerciseHistory,
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
