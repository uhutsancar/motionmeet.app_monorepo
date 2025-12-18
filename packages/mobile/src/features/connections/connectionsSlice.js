import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getUserConnections } from '../../api/endpoints';

const initialState = {
  connections: [],
  pendingConnections: [],
  followers: [],
  following: [],
  loading: false,
  error: null,
};

export const fetchConnections = createAsyncThunk(
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
    setConnections: (state, action) => {
      state.connections = action.payload;
    },
    setPendingConnections: (state, action) => {
      state.pendingConnections = action.payload;
    },
    setFollowers: (state, action) => {
      state.followers = action.payload;
    },
    setFollowing: (state, action) => {
      state.following = action.payload;
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
        state.error = action.error.message;
      });
  },
});

export const { setConnections, setPendingConnections, setFollowers, setFollowing } = connectionsSlice.actions;
export default connectionsSlice.reducer;
