import { combineReducers, configureStore, createAction, type UnknownAction } from "@reduxjs/toolkit";
import userReducer from "../features/user/userSlice";
import postsReducer from "../features/posts/postsSlice";
import storiesReducer from "../features/stories/storiesSlice";
import connectionsReducer from "../features/connections/connectionsSlice";
import messagesReducer from "../features/messages/messagesSlice";
import notificationsReducer from "../features/notifications/notificationsSlice";
import relationshipsReducer from "../features/relationships/relationshipsSlice";

export const clearSessionState = createAction("session/clear-sensitive-state");

const appReducer = combineReducers({
  user: userReducer,
  posts: postsReducer,
  stories: storiesReducer,
  connections: connectionsReducer,
  messages: messagesReducer,
  notifications: notificationsReducer,
  relationships: relationshipsReducer,
});

const rootReducer = (
  state: ReturnType<typeof appReducer> | undefined,
  action: UnknownAction,
) => appReducer(clearSessionState.match(action) ? undefined : state, action);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
