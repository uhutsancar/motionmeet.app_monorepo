import api from './axios';
import {
  API_ROUTES,
  createOperationId,
  type BodyMeasurement,
  type BodyMeasurementValues,
  type DistanceVisibility,
  type ExerciseSessionEntry,
  type LocationSuggestion,
  type Message,
  type NearbyScope,
  type NearbySettings,
  type NearbyUser,
  type Notification,
  type ProfileLocation,
  type ProfileLocationSource,
  type ProfileLocationVisibility,
  type Post,
  type PublicUser,
  type RelationshipState,
  type Story,
  type StoryViewer,
  type Workout,
  type WorkoutStats,
} from '@motionmeet/shared';

type Token = string;
type Cursor = string | null | undefined;
type OperationPayload = FormData | (Record<string, unknown> & { operationId?: string });
interface BasicResponse { success: boolean; message?: string }
interface UsersResponse extends BasicResponse { users: PublicUser[] }
interface ConnectionsResponse extends BasicResponse { connections: PublicUser[]; pendingConnections: PublicUser[]; followers: PublicUser[]; following: PublicUser[]; items?: PublicUser[]; nextCursor?: string | null }
interface MessageResponse { success: boolean; message: Message; messageId?: string }
interface FeedResponse extends BasicResponse { posts: Post[]; nextCursor: string | null }
interface PostResponse extends BasicResponse { post: Post }
interface LikeResponse extends BasicResponse { liked: boolean; like_count: number }
interface StoriesResponse extends BasicResponse { stories: Story[]; nextCursor: string | null }
interface StoryResponse extends BasicResponse { story: Story }
interface StoryViewersResponse extends BasicResponse { viewers: StoryViewer[] }
interface WorkoutResponse extends BasicResponse { workout: Workout }
interface ExerciseHistoryResponse extends BasicResponse { history: ExerciseSessionEntry[] }
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

// POST
export const getFeed = async (token: Token, cursor?: Cursor, mode: "discover" | "following" = 'discover'): Promise<FeedResponse> => {
  const { data } = await api.get<FeedResponse>(API_ROUTES.post.feed, {
    headers: { Authorization: `Bearer ${token}` },
    params: { ...(cursor ? { cursor } : {}), mode },
  });
  return data;
};

/**
 * One post by id, for a reader who is signed in.
 *
 * The server applies the same visibility rules the feed does, so a
 * followers-only post opened from a link is a 404 for anyone the author has not
 * let in.
 */
export const getPost = async (postId: string, token: Token): Promise<PostResponse> => {
  const { data } = await api.get<PostResponse>(API_ROUTES.post.byId(postId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

/** The same post for a visitor with no account, and only if it is fully public. */
export const getPublicPost = async (postId: string): Promise<PostResponse> => {
  const { data } = await api.get<PostResponse>(API_ROUTES.post.publicById(postId));
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

export const deletePost = async (postId: string, token: Token): Promise<BasicResponse> => {
  const { data } = await api.delete<BasicResponse>(API_ROUTES.post.delete(postId), {
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

export const getExerciseHistory = async (exerciseId: string, token: Token, limit?: number): Promise<ExerciseHistoryResponse> => {
  const { data } = await api.get<ExerciseHistoryResponse>(API_ROUTES.exercise.history(exerciseId), {
    headers: { Authorization: `Bearer ${token}` },
    params: limit ? { limit } : undefined,
  });
  return data;
};
