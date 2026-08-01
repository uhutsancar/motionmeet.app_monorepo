import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getMessages } from '../../api/endpoints';
import { type PayloadAction } from '@reduxjs/toolkit';
import type { Message, PublicUser } from '@motionmeet/shared';

interface MessagesState { messages: Message[]; currentChat: PublicUser | null; loading: boolean; error: string | null }

const initialState: MessagesState = {
  messages: [],
  currentChat: null,
  loading: false,
  error: null,
};

export const fetchMessages = createAsyncThunk<Message[], { token: string; userId: string }>(
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
    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      const message = action.payload;
      if (!message?._id || !state.messages.some((item) => item._id === message._id)) {
        state.messages.push(message);
      }
    },
    prependMessages: (state, action: PayloadAction<Message[]>) => {
      const knownIds = new Set(state.messages.map((message) => message._id));
      state.messages = [
        ...action.payload.filter((message) => !knownIds.has(message._id)),
        ...state.messages,
      ];
    },
    removeMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter(msg => msg._id !== action.payload);
    },
    markMessagesSeenByUser: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.map((message) => {
        const toId = typeof message.to_user_id === 'string' ? message.to_user_id : message.to_user_id._id;
        return toId === action.payload ? { ...message, seen: true } : message;
      });
    },
    resetMessages: (state) => {
      state.messages = [];
    },
    setCurrentChat: (state, action: PayloadAction<PublicUser | null>) => {
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
        state.error = action.error.message ?? null;
      });
  },
});

export const {
  setMessages,
  addMessage,
  prependMessages,
  removeMessage,
  markMessagesSeenByUser,
  resetMessages,
  setCurrentChat,
} = messagesSlice.actions;
export default messagesSlice.reducer;
