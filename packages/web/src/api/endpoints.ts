import api from './axios';
import {
  API_ROUTES,
  createOperationId,
  type BodyMeasurement,
  type BodyMeasurementValues,
  type Comment,
  type Conversation,
  type DistanceVisibility,
  type Exercise,
  type ExerciseSessionEntry,
  type ExerciseStats,
  type LocationSuggestion,
  type Message,
  type NearbyScope,
  type NearbySettings,
  type NearbyUser,
  type Notification,
  type PersonalRecord,
  type Plan,
  type ProfileLocation,
  type ProfileLocationSource,
  type ProfileLocationVisibility,
  type Post,
  type PublicUser,
  type RelationshipState,
  type Routine,
  type Story,
  type StoryViewer,
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
interface CommentsResponse extends BasicResponse { comments: Comment[]; nextCursor: string | null }
interface LikeResponse extends BasicResponse { liked: boolean; like_count: number }
interface StoriesResponse extends BasicResponse { stories: Story[]; nextCursor: string | null }
interface StoryResponse extends BasicResponse { story: Story }
interface StoryViewersResponse extends BasicResponse { viewers: StoryViewer[] }
interface WorkoutsResponse extends BasicResponse { workouts: Workout[]; nextCursor: string | null }
interface WorkoutResponse extends BasicResponse { workout: Workout }
interface RoutinesResponse extends BasicResponse { routines: Routine[]; nextCursor: string | null }
interface RoutineResponse extends BasicResponse { routine: Routine }
interface ExercisesResponse extends BasicResponse { exercises: Exercise[]; total: number | null; nextCursor: string | null; limit: number; skip: number }
interface ExerciseResponse extends BasicResponse { exercise: Exercise }
interface ExerciseStatsResponse extends BasicResponse, ExerciseStats {}
interface ExerciseHistoryResponse extends BasicResponse { history: ExerciseSessionEntry[] }
interface RecordsResponse extends BasicResponse { records: PersonalRecord[] }
interface PlansResponse extends BasicResponse { plans: Plan[] }
interface MetadataResponse extends BasicResponse { data: Array<{ code: string; name: string }> }
interface RelationshipResponse extends BasicResponse { relationship: RelationshipState; action?: 'followed' | 'requested' | 'already_requested' | 'already_following' }
interface FollowRequestsResponse extends BasicResponse { items: Array<{ user: PublicUser; createdAt: string }>; nextCursor: string | null }
interface NotificationsResponse extends BasicResponse { items: Notification[]; nextCursor: string | null; unreadCount: number }
interface UnreadCountResponse extends BasicResponse { unreadCount: number }
interface MeasurementsResponse extends BasicResponse { measurements: BodyMeasurement[] }
interface MeasurementResponse extends BasicResponse { measurement: BodyMeasurement }

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

/**
 * Follows an open account and sends a request to a private one. Which happened
 * is only knowable from the response, so this returns the resulting
 * relationship rather than a bare success flag.
 */
export const requestFollow = async (userId: string, token: Token): Promise<RelationshipResponse> => {
  const { data } = await api.post<RelationshipResponse>(API_ROUTES.followRequest.send, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

/** Kept as an alias so older call sites keep compiling; it sends a request too. */
export const followUser = requestFollow;

export const unfollowUser = async (userId: string, token: Token): Promise<RelationshipResponse> => {
  const { data } = await api.post<RelationshipResponse>(API_ROUTES.user_extras.unfollow, { id: userId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const cancelFollowRequest = async (userId: string, token: Token): Promise<RelationshipResponse> => {
  const { data } = await api.delete<RelationshipResponse>(API_ROUTES.followRequest.cancel(userId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const acceptFollowRequest = async (requesterId: string, token: Token): Promise<RelationshipResponse> => {
  const { data } = await api.post<RelationshipResponse>(API_ROUTES.followRequest.accept(requesterId), {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const declineFollowRequest = async (requesterId: string, token: Token): Promise<RelationshipResponse> => {
  const { data } = await api.post<RelationshipResponse>(API_ROUTES.followRequest.decline(requesterId), {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getIncomingFollowRequests = async (token: Token, cursor?: Cursor): Promise<FollowRequestsResponse> => {
  const { data } = await api.get<FollowRequestsResponse>(API_ROUTES.followRequest.incoming, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const getOutgoingFollowRequests = async (token: Token, cursor?: Cursor): Promise<FollowRequestsResponse> => {
  const { data } = await api.get<FollowRequestsResponse>(API_ROUTES.followRequest.outgoing, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const getRelationship = async (userId: string, token: Token): Promise<RelationshipResponse> => {
  const { data } = await api.get<RelationshipResponse>(API_ROUTES.user_extras.relationship(userId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// NOTIFICATIONS
export const getNotifications = async (token: Token, cursor?: Cursor): Promise<NotificationsResponse> => {
  const { data } = await api.get<NotificationsResponse>(API_ROUTES.notification.list, {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
  });
  return data;
};

export const getUnreadNotificationCount = async (token: Token): Promise<UnreadCountResponse> => {
  const { data } = await api.get<UnreadCountResponse>(API_ROUTES.notification.unreadCount, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const markNotificationsRead = async (token: Token): Promise<UnreadCountResponse> => {
  const { data } = await api.post<UnreadCountResponse>(API_ROUTES.notification.readAll, {}, {
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

// PROFILE LOCATION
// The profile update endpoint no longer accepts a location string: a place has
// to be picked from the reference dataset so the backend can render the label
// itself. These two calls are the whole write path.
interface LocationSearchResponse extends BasicResponse { results: LocationSuggestion[] }
interface LocationResolveResponse extends BasicResponse { suggestion: LocationSuggestion | null; approximateArea: string | null }
interface ProfileLocationResponse extends BasicResponse { location: ProfileLocation }
interface NearbySettingsResponse extends BasicResponse { settings: NearbySettings }
interface NearbyUsersResponse extends NearbySettingsResponse {
  users: NearbyUser[];
  reason: 'disabled' | 'no_fix' | 'stale_fix' | 'no_results' | null;
}

export const searchLocations = async (
  query: string,
  token: Token,
  options: { locale?: string; country?: string | null; limit?: number; signal?: AbortSignal } = {},
): Promise<LocationSearchResponse> => {
  const { data } = await api.get<LocationSearchResponse>(API_ROUTES.location.search, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      q: query,
      ...(options.locale ? { locale: options.locale } : {}),
      ...(options.country ? { country: options.country } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
    },
    // Lets the picker cancel the request a keystroke made obsolete.
    signal: options.signal,
  });
  return data;
};

export const getRecentLocations = async (token: Token, locale?: string): Promise<LocationSearchResponse> => {
  const { data } = await api.get<LocationSearchResponse>(API_ROUTES.location.recent, {
    headers: { Authorization: `Bearer ${token}` },
    params: locale ? { locale } : undefined,
  });
  return data;
};

/** Turns a device fix into a suggestion. Saves nothing until the member agrees. */
export const resolveCoordinates = async (
  coordinates: { latitude: number; longitude: number },
  token: Token,
  locale?: string,
): Promise<LocationResolveResponse> => {
  const { data } = await api.post<LocationResolveResponse>(API_ROUTES.location.resolve, coordinates, {
    headers: { Authorization: `Bearer ${token}` },
    params: locale ? { locale } : undefined,
  });
  return data;
};

export const getProfileLocation = async (token: Token): Promise<ProfileLocationResponse> => {
  const { data } = await api.get<ProfileLocationResponse>(API_ROUTES.profileLocation.base, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const saveProfileLocation = async (
  selection: { cityId?: number; stateId?: number; countryId?: number; source?: ProfileLocationSource; visibility?: ProfileLocationVisibility },
  token: Token,
  locale?: string,
): Promise<ProfileLocationResponse> => {
  const { data } = await api.put<ProfileLocationResponse>(API_ROUTES.profileLocation.base, selection, {
    headers: { Authorization: `Bearer ${token}` },
    params: locale ? { locale } : undefined,
  });
  return data;
};

export const setProfileLocationVisibility = async (
  visibility: ProfileLocationVisibility,
  token: Token,
): Promise<ProfileLocationResponse> => {
  const { data } = await api.patch<ProfileLocationResponse>(API_ROUTES.profileLocation.base, { visibility }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const clearProfileLocation = async (token: Token): Promise<ProfileLocationResponse> => {
  const { data } = await api.delete<ProfileLocationResponse>(API_ROUTES.profileLocation.base, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

// NEARBY
// Nothing below ever receives coordinates back from the server: the nearby
// endpoints answer with distance bands and coarse area labels only.
export const getNearbySettings = async (token: Token): Promise<NearbySettingsResponse> => {
  const { data } = await api.get<NearbySettingsResponse>(API_ROUTES.nearby.settings, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const updateNearbySettings = async (
  patch: { enabled?: boolean; visible?: boolean; distanceVisibility?: DistanceVisibility; scope?: NearbyScope },
  token: Token,
): Promise<NearbySettingsResponse> => {
  const { data } = await api.patch<NearbySettingsResponse>(API_ROUTES.nearby.settings, patch, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

/** Sends a fix. The coordinates leave the browser and are never returned. */
export const updateNearbyPosition = async (
  fix: { latitude: number; longitude: number; accuracy?: number | null; source?: 'gps' | 'network' | 'coarse'; permissionStatus?: string },
  token: Token,
): Promise<NearbySettingsResponse> => {
  const { data } = await api.put<NearbySettingsResponse>(API_ROUTES.nearby.position, fix, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const deleteNearbyPosition = async (token: Token): Promise<NearbySettingsResponse> => {
  const { data } = await api.delete<NearbySettingsResponse>(API_ROUTES.nearby.position, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const getNearbyUsers = async (token: Token, limit?: number): Promise<NearbyUsersResponse> => {
  const { data } = await api.get<NearbyUsersResponse>(API_ROUTES.nearby.users, {
    headers: { Authorization: `Bearer ${token}` },
    params: limit ? { limit } : undefined,
  });
  return data;
};

// MEASUREMENTS
export interface SaveMeasurementPayload extends BodyMeasurementValues {
  /** Calendar day as YYYY-MM-DD; the backend upserts on this day. */
  measuredOn: string;
  note?: string;
}

export const getMeasurements = async (token: Token, limit?: number): Promise<MeasurementsResponse> => {
  const { data } = await api.get<MeasurementsResponse>(API_ROUTES.measurement.base, {
    headers: { Authorization: `Bearer ${token}` },
    params: limit ? { limit } : undefined,
  });
  return data;
};

export const saveMeasurement = async (payload: SaveMeasurementPayload, token: Token): Promise<MeasurementResponse> => {
  const { data } = await api.post<MeasurementResponse>(API_ROUTES.measurement.base, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

export const deleteMeasurement = async (measurementId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.delete<BasicResponse>(API_ROUTES.measurement.byId(measurementId), {
    headers: { Authorization: `Bearer ${token}` },
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

/** @deprecated Use likePostIdempotent / unlikePostIdempotent instead */
export const likePost = async (postId: string, token: Token): Promise<BasicResponse & { liked?: boolean; like_count?: number }> => {
  const { data } = await api.post<BasicResponse & { liked?: boolean; like_count?: number }>(API_ROUTES.post.like, { postId }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

// The payload is deliberately an empty object rather than `null` so the request
// always carries a JSON content type, which is all the API accepts.
export const likePostIdempotent = async (postId: string, token: Token): Promise<LikeResponse> => {
  const { data } = await api.put<LikeResponse>(API_ROUTES.post.likeIdempotent(postId), {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const unlikePostIdempotent = async (postId: string, token: Token): Promise<LikeResponse> => {
  const { data } = await api.delete<LikeResponse>(API_ROUTES.post.unlike(postId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getPostComments = async (postId: string, token: Token, cursor?: Cursor): Promise<CommentsResponse> => {
  const { data } = await api.get<CommentsResponse>(API_ROUTES.post.comments(postId), {
    headers: { Authorization: `Bearer ${token}` },
    params: cursor ? { cursor } : undefined,
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

export const markStoryViewed = async (storyId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.post<BasicResponse>(API_ROUTES.story.view(storyId), {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

export const getStoryViewers = async (storyId: string, token: Token): Promise<StoryViewersResponse> => {
  const { data } = await api.get<StoryViewersResponse>(API_ROUTES.story.viewers(storyId), {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

/**
 * Reacts to a story, or takes the reaction back.
 *
 * The heart used to type "❤️" into the reply box and send it as a direct
 * message, which put a reaction in the author's inbox and gave no way to undo
 * it. This writes a like and notifies the author instead.
 */
export const setStoryLike = async (
  storyId: string,
  liked: boolean,
  token: Token,
): Promise<BasicResponse & { liked?: boolean }> => {
  const url = API_ROUTES.story.like(storyId);
  const config = { headers: { Authorization: `Bearer ${token}` } };
  const { data } = liked
    ? await api.post<BasicResponse & { liked?: boolean }>(url, {}, config)
    : await api.delete<BasicResponse & { liked?: boolean }>(url, config);
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

export const getExerciseHistory = async (exerciseId: string, token: Token, limit?: number): Promise<ExerciseHistoryResponse> => {
  const { data } = await api.get<ExerciseHistoryResponse>(API_ROUTES.exercise.history(exerciseId), {
    headers: { Authorization: `Bearer ${token}` },
    params: limit ? { limit } : undefined,
  });
  return data;
};

export const getPersonalRecords = async (token: Token): Promise<RecordsResponse> => {
  const { data } = await api.get<RecordsResponse>(API_ROUTES.exercise.records, {
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
