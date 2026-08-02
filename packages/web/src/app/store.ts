import { combineReducers, configureStore, createAction, type UnknownAction } from "@reduxjs/toolkit";
import userReducer from "../features/user/userSlice.js";
import connectionsReducer from "../features/connections/connectionsSlice.js";
import messagesReducer from "../features/messages/messagesSlice.js";

export const clearSessionState = createAction("session/clear-sensitive-state");

const appReducer = combineReducers({
  user: userReducer,
  connections: connectionsReducer,
  messages: messagesReducer,
});

const rootReducer = (
  state: ReturnType<typeof appReducer> | undefined,
  action: UnknownAction,
) => appReducer(clearSessionState.match(action) ? undefined : state, action);

export const store = configureStore({ reducer: rootReducer });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
