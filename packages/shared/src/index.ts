export * from "./types/auth.js";
export * from "./types/common.js";
export * from "./types/exercise.js";
export * from "./types/location.js";
export * from "./types/measurement.js";
export * from "./types/media.js";
export * from "./types/message.js";
export * from "./types/post.js";
export * from "./types/story.js";
export * from "./types/user.js";
export * from "./types/workout.js";

export const API_ROUTES = Object.freeze({
  auth: Object.freeze({ login: "/api/auth/login", logout: "/api/auth/logout", forgotPassword: "/api/auth/forgot-password", resetPassword: "/api/auth/reset-password", me: "/api/auth/me", refresh: "/api/auth/refresh", register: "/api/auth/register" }),
  user: Object.freeze({ account: "/api/user/account", data: "/api/user/data", export: "/api/user/export", privacy: "/api/user/privacy" }),
  media: Object.freeze({ presign: "/api/media/presign" }),
  post: Object.freeze({ add: "/api/post/add", comment: "/api/post/comment/add", comments: (postId: string) => `/api/post/${postId}/comments`, delete: (postId: string) => `/api/post/${postId}`, feed: "/api/post/feed", like: "/api/post/like", likeIdempotent: (postId: string) => `/api/post/${postId}/like`, unlike: (postId: string) => `/api/post/${postId}/like` }),
  message: Object.freeze({ get: "/api/message/get", send: "/api/message/send", seen: "/api/message/seen", recent: "/api/message/recent", delete: (messageId: string) => `/api/message/delete/${messageId}`, conversations: "/api/message/conversations" }),
  story: Object.freeze({ get: "/api/story/get", create: "/api/story/create", delete: (storyId: string) => `/api/story/delete/${storyId}`, view: (storyId: string) => `/api/story/${storyId}/view`, viewers: (storyId: string) => `/api/story/${storyId}/viewers` }),
  workout: Object.freeze({ base: "/api/workout", stats: "/api/workout/stats" }),
  routine: Object.freeze({ base: "/api/routine" }),
  exercise: Object.freeze({ base: "/api/exercise", byId: (exerciseId: string) => `/api/exercise/${exerciseId}`, records: "/api/exercise/records", stats: (exerciseId: string) => `/api/exercise/${exerciseId}/stats`, history: (exerciseId: string) => `/api/exercise/${exerciseId}/history` }),
  plan: Object.freeze({ base: "/api/plans", update: "/api/plans/update" }),
  user_extras: Object.freeze({ update: "/api/user/update", profiles: "/api/user/profiles", discover: "/api/user/discover", follow: "/api/user/follow", unfollow: "/api/user/unfollow", connect: "/api/user/connect", accept: "/api/user/accept", remove_connection: "/api/user/connection", connections: "/api/user/connections", recent_messages: "/api/user/recent-messages", suggested: "/api/user/suggested", relationship: (userId: string) => `/api/user/${userId}/relationship` }),
  followRequest: Object.freeze({
    /** Ask to follow someone; answers with the resulting relationship state. */
    send: "/api/user/follow-requests",
    incoming: "/api/user/follow-requests/incoming",
    outgoing: "/api/user/follow-requests/outgoing",
    accept: (requesterId: string) => `/api/user/follow-requests/${requesterId}/accept`,
    decline: (requesterId: string) => `/api/user/follow-requests/${requesterId}/decline`,
    cancel: (targetId: string) => `/api/user/follow-requests/${targetId}`,
  }),
  notification: Object.freeze({
    list: "/api/notifications",
    unreadCount: "/api/notifications/unread-count",
    readAll: "/api/notifications/read",
  }),
  measurement: Object.freeze({ base: "/api/measurements", byId: (measurementId: string) => `/api/measurements/${measurementId}` }),
  metadata: Object.freeze({ muscleGroups: "/api/muscle-groups", equipment: "/api/equipment" }),
  location: Object.freeze({
    search: "/api/locations/search",
    countries: "/api/locations/countries",
    resolve: "/api/locations/resolve",
    recent: "/api/locations/recent",
    attribution: "/api/locations/attribution",
    byKind: (kind: string, id: number) => `/api/locations/${kind}/${id}`,
  }),
  profileLocation: Object.freeze({ base: "/api/user/location" }),
  nearby: Object.freeze({
    settings: "/api/nearby/settings",
    position: "/api/nearby/position",
    users: "/api/nearby/users",
  }),
});

export const PRIVACY_DEFAULTS = Object.freeze({ publicProfile: true, showWorkoutsOnFeed: true, allowFollowers: true, showInSearch: true, allowMessages: true });
export const PRIVACY_KEYS = Object.freeze(Object.keys(PRIVACY_DEFAULTS) as Array<keyof typeof PRIVACY_DEFAULTS>);
export const PAGINATION_DEFAULTS = Object.freeze({ comments: 30, conversations: 50, exercises: 50, feed: 30, messages: 50, routines: 50, stories: 50, workouts: 30 });
export const CONTENT_LIMITS = Object.freeze({ comment: 1000, exerciseName: 80, message: 2000, post: 5000, postMediaItems: 4, routineName: 120, story: 2000 });
export const AUTH_LIMITS = Object.freeze({ email: 254, fullNameMin: 2, fullNameMax: 100, passwordMinBytes: 10, passwordMaxBytes: 72, usernameMin: 3, usernameMax: 30 });

export const getUtf8ByteLength = (value: unknown): number => {
  if (typeof value !== "string") return 0;
  return new TextEncoder().encode(value).byteLength;
};

export const hasValidPasswordByteLength = (value: unknown): value is string => {
  const byteLength = getUtf8ByteLength(value);
  return byteLength >= AUTH_LIMITS.passwordMinBytes && byteLength <= AUTH_LIMITS.passwordMaxBytes;
};

export const createOperationId = (prefix = "op"): string => {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${randomPart}`.slice(0, 128);
};

export const resolvePublicMediaUrl = (value: unknown, origin = ""): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (origin && normalized.startsWith("/")) return `${origin.replace(/\/+$/, "")}${normalized}`;
  return null;
};
