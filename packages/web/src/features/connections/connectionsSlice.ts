import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "~/api/axios";
import { API_ROUTES, type PublicUser } from "@motionmeet/shared";

interface ConnectionsState { connections: PublicUser[]; pendingConnections: PublicUser[]; followers: PublicUser[]; following: PublicUser[] }
interface ConnectionsResponse extends ConnectionsState { success: boolean }

const initialState: ConnectionsState = {
  connections: [],
  pendingConnections: [],
  followers: [],
  following: [],
};

export const fetchConnections = createAsyncThunk<ConnectionsResponse | null, string>(
  "connections/fetchConnections",
  async (token) => {
    const { data } = await api.get<ConnectionsResponse>(API_ROUTES.user_extras.connections, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.success ? data : null;
  }
);

const connectionsSlice = createSlice({
  name: "connections",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchConnections.fulfilled, (state, action) => {
      if (action.payload) {
        state.connections = action.payload.connections;
        state.pendingConnections = action.payload.pendingConnections;
        state.followers = action.payload.followers;
        state.following = action.payload.following;
      }
    });
  },
});

export default connectionsSlice.reducer;
