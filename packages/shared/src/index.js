export const API_ROUTES = Object.freeze({
  auth: Object.freeze({
    login: "/api/auth/login",
    logout: "/api/auth/logout",
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
    delete: (postId) => `/api/post/delete/${postId}`,
    feed: "/api/post/feed",
    like: "/api/post/like",
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
  feed: 30,
  messages: 50,
  routines: 50,
  workouts: 30,
});
