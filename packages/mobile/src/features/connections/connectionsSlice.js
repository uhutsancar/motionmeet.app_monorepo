import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connections: [],
  pendingConnections: [],
  followers: [],
  following: [],
};

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
});

export const { setConnections, setPendingConnections, setFollowers, setFollowing } = connectionsSlice.actions;
export default connectionsSlice.reducer;
