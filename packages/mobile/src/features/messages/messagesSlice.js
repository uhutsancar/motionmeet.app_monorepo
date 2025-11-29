import { createSlice } from '@reduxjs/toolkit';
import { dummyMessagesData, dummyRecentMessagesData } from '../../assets/assets';

const initialState = {
    messages: dummyMessagesData,
    recentMessages: dummyRecentMessagesData,
    loading: false,
    error: null,
};

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        setMessages: (state, action) => {
            state.messages = action.payload;
        },
        addMessage: (state, action) => {
            state.messages.push(action.payload);
        },
        setRecentMessages: (state, action) => {
            state.recentMessages = action.payload;
        },
        markAsSeen: (state, action) => {
            const messageId = action.payload;
            const message = state.messages.find(m => m._id === messageId);
            if (message) {
                message.seen = true;
            }
        },
    },
});

export const { setMessages, addMessage, setRecentMessages, markAsSeen } = messagesSlice.actions;
export default messagesSlice.reducer;
