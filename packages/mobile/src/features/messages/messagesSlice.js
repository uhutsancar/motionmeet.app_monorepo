import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  messages: [],
  currentChat: null,
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
    setCurrentChat: (state, action) => {
      state.currentChat = action.payload;
    },
  },
});

export const { setMessages, addMessage, setCurrentChat } = messagesSlice.actions;
export default messagesSlice.reducer;
