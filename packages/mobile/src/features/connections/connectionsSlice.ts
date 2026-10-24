import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getUserConnections } from '../../api/endpoints';
import { type PayloadAction } from '@reduxjs/toolkit';
import type { PublicUser } from '@motionmeet/shared';

interface ConnectionsState { connections: PublicUser[]; pendingConnections: PublicUser[]; followers: PublicUser[]; following: PublicUser[]; loading: boolean; error: string | null }
type ConnectionsPayload = Pick<ConnectionsState, 'connections' | 'pendingConnections' | 'followers' | 'following'>;

const initialState: ConnectionsState = {
  connections: [],
  pendingConnections: [],
  followers: [],
  following: [],
  loading: false,
  error: null,
};

export const fetchConnections = createAsyncThunk<ConnectionsPayload | null, string>(
  'connections/fetchConnections',
  async (token) => {
    const data = await getUserConnections(token);
    return data.success ? data : null;
  }
);

const connectionsSlice = createSlice({
  name: 'connections',
  initialState,
  reducers: {
    setConnections: (state, action: PayloadAction<PublicUser[]>) => {
      state.connections = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConnections.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchConnections.fulfilled, (state, action) => {
        if (action.payload) {
          state.connections = action.payload.connections;
          state.pendingConnections = action.payload.pendingConnections;
          state.followers = action.payload.followers;
          state.following = action.payload.following;
        }
        state.loading = false;
      })
      .addCase(fetchConnections.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? null;
      });
  },
});

export const { setConnections } = connectionsSlice.actions;
export default connectionsSlice.reducer;
