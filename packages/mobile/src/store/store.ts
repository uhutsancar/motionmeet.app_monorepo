import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../features/user/userSlice";
import postsReducer from "../features/posts/postsSlice";
import storiesReducer from "../features/stories/storiesSlice";
import connectionsReducer from "../features/connections/connectionsSlice";
import messagesReducer from "../features/messages/messagesSlice";

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

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
