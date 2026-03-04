import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getMessages } from '../../api/endpoints';

const initialState = {
  messages: [],
  currentChat: null,
  loading: false,
  error: null,
};

export const fetchMessages = createAsyncThunk(
  'messages/fetchMessages',
  async ({ token, userId }) => {
    const data = await getMessages(userId, token);
    return data.success ? data.messages : [];
  }
);

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
    removeMessage: (state, action) => {
      state.messages = state.messages.filter(msg => msg._id !== action.payload);
    },
    resetMessages: (state) => {
      state.messages = [];
    },
    setCurrentChat: (state, action) => {
      state.currentChat = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.messages = action.payload;
        state.loading = false;
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const { setMessages, addMessage, removeMessage, resetMessages, setCurrentChat } = messagesSlice.actions;
export default messagesSlice.reducer;
