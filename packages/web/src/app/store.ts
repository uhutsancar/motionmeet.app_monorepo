import { combineReducers, configureStore, createAction, type UnknownAction } from "@reduxjs/toolkit";
import userReducer from "../features/user/userSlice.js";
import postsReducer from "../features/posts/postsSlice.js";
import storiesReducer from "../features/stories/storiesSlice.js";
import connectionsReducer from "../features/connections/connectionsSlice.js";
import messagesReducer from "../features/messages/messagesSlice.js";
import notificationsReducer from "../features/notifications/notificationsSlice.js";
import relationshipsReducer from "../features/relationships/relationshipsSlice.js";

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

export const store = configureStore({ reducer: rootReducer });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
