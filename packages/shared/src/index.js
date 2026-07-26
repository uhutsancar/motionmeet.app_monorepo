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
  }),
  message: Object.freeze({
    get: "/api/message/get",
    send: "/api/message/send",
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
    connections: "/api/user/connections",
    recent_messages: "/api/user/recent-messages",
    suggested: "/api/user/suggested",
  })
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
  feed: 30,
  messages: 50,
  routines: 50,
  workouts: 30,
});

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
