export const API_ROUTES = Object.freeze({
  auth: Object.freeze({
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    forgotPassword: "/api/auth/forgot-password",
    resetPassword: "/api/auth/reset-password",
    me: "/api/auth/me",
    refresh: "/api/auth/refresh",
    register: "/api/auth/register",
  }),
  user: Object.freeze({
    account: "/api/user/account",
    data: "/api/user/data",
    export: "/api/user/export",
    privacy: "/api/user/privacy",
  }),
  media: Object.freeze({
    presign: "/api/media/presign",
  }),
  post: Object.freeze({
    add: "/api/post/add",
    comment: "/api/post/comment/add",
    comments: (postId) => `/api/post/${postId}/comments`,
    delete: (postId) => `/api/post/${postId}`,
    feed: "/api/post/feed",
    like: "/api/post/like",
    likeIdempotent: (postId) => `/api/post/${postId}/like`,
    unlike: (postId) => `/api/post/${postId}/like`,
  }),
  message: Object.freeze({
    get: "/api/message/get",
    send: "/api/message/send",
    seen: "/api/message/seen",
    recent: "/api/message/recent",
    delete: (messageId) => `/api/message/delete/${messageId}`,
    conversations: "/api/message/conversations",
  }),
  story: Object.freeze({
    get: "/api/story/get",
    create: "/api/story/create",
    delete: (storyId) => `/api/story/delete/${storyId}`,
  }),
  workout: Object.freeze({
    base: "/api/workout",
    stats: "/api/workout/stats",
  }),
  routine: Object.freeze({
    base: "/api/routine",
  }),
  exercise: Object.freeze({
    base: "/api/exercise",
    byId: (exerciseId) => `/api/exercise/${exerciseId}`,
    records: "/api/exercise/records",
    stats: (exerciseId) => `/api/exercise/${exerciseId}/stats`,
  }),
  plan: Object.freeze({
    base: "/api/plans",
    update: "/api/plans/update",
  }),
  user_extras: Object.freeze({
    update: "/api/user/update",
    profiles: "/api/user/profiles",
    discover: "/api/user/discover",
    follow: "/api/user/follow",
    unfollow: "/api/user/unfollow",
    connect: "/api/user/connect",
    accept: "/api/user/accept",
    remove_connection: "/api/user/connection",
    connections: "/api/user/connections",
    recent_messages: "/api/user/recent-messages",
    suggested: "/api/user/suggested",
  }),
  metadata: Object.freeze({
    muscleGroups: "/api/muscle-groups",
    equipment: "/api/equipment",
  }),
});

export const PRIVACY_DEFAULTS = Object.freeze({
  publicProfile: true,
  showWorkoutsOnFeed: true,
  allowFollowers: true,
  showInSearch: true,
  allowMessages: true,
});

export const PRIVACY_KEYS = Object.freeze(Object.keys(PRIVACY_DEFAULTS));

export const PAGINATION_DEFAULTS = Object.freeze({
  comments: 30,
  conversations: 50,
  exercises: 50,
  feed: 30,
  messages: 50,
  routines: 50,
  stories: 50,
  workouts: 30,
});

export const CONTENT_LIMITS = Object.freeze({
  comment: 1000,
  exerciseName: 80,
  message: 2000,
  post: 5000,
  postMediaItems: 4,
  routineName: 120,
  story: 2000,
});

export const AUTH_LIMITS = Object.freeze({
  email: 254,
  fullNameMin: 2,
  fullNameMax: 100,
  passwordMinBytes: 10,
  passwordMaxBytes: 72,
  usernameMin: 3,
  usernameMax: 30,
});

export const getUtf8ByteLength = (value) => {
  if (typeof value !== "string") return 0;
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

export const hasValidPasswordByteLength = (value) => {
  const byteLength = getUtf8ByteLength(value);
  return (
    byteLength >= AUTH_LIMITS.passwordMinBytes &&
    byteLength <= AUTH_LIMITS.passwordMaxBytes
  );
};

export const createOperationId = (prefix = "op") => {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
      .toString(36)
      .slice(2)}`;
  return `${prefix}:${randomPart}`.slice(0, 128);
};

export const resolvePublicMediaUrl = (value, origin = "") => {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  if (/^https:\/\//i.test(normalized)) return normalized;
  if (/^http:\/\//i.test(normalized)) {
    return normalized;
  }
  if (origin && normalized.startsWith("/")) {
    return `${origin.replace(/\/+$/, "")}${normalized}`;
  }
  return null;
};
