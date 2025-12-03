import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../features/user/userSlice.js";
import postsReducer from "../features/posts/postsSlice.js";
import storiesReducer from "../features/stories/storiesSlice.js";
import connectionsReducer from "../features/connections/connectionsSlice.js";
import messagesReducer from "../features/messages/messagesSlice.js";

export const store = configureStore({
  reducer: {
    user: userReducer,
    posts: postsReducer,
    stories: storiesReducer,
    connections: connectionsReducer,
    messages: messagesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});
