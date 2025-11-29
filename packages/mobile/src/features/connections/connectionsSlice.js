import { createSlice } from '@reduxjs/toolkit';
import { dummyConnectionsData, dummyFollowersData, dummyFollowingData, dummyPendingConnectionsData } from '../../assets/assets';

const initialState = {
    connections: dummyConnectionsData,
    pendingConnections: dummyPendingConnectionsData,
    followers: dummyFollowersData,
    following: dummyFollowingData,
    loading: false,
    error: null,
};

const connectionsSlice = createSlice({
    name: 'connections',
    initialState,
    reducers: {
        setConnections: (state, action) => {
            state.connections = action.payload.connections;
            state.pendingConnections = action.payload.pendingConnections;
            state.followers = action.payload.followers;
            state.following = action.payload.following;
        },
        addFollowing: (state, action) => {
            state.following.push(action.payload);
        },
        removeFollowing: (state, action) => {
            state.following = state.following.filter(user => user._id !== action.payload);
        },
        addConnection: (state, action) => {
            state.connections.push(action.payload);
        },
    },
});

export const { setConnections, addFollowing, removeFollowing, addConnection } = connectionsSlice.actions;
export default connectionsSlice.reducer;
