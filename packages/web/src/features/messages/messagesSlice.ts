import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import api from "~/api/axios";
import { API_ROUTES, type Message } from "@motionmeet/shared";

interface MessagesState { messages: Message[] }
interface MessagesResponse { success: boolean; messages: Message[] }
interface FetchMessagesArgument { token: string; userId: string }

const initialState: MessagesState = {
  messages: [],
};

export const fetchMessages = createAsyncThunk<MessagesResponse | null, FetchMessagesArgument>(
  "messages/fetchMessages",
  async ({ token, userId }) => {
    const { data } = await api.post<MessagesResponse>(
      API_ROUTES.message.get,
      { to_user_id: userId },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return data.success ? data : null;
  }
);

const messagesSlice = createSlice({
  name: "messages",
  initialState,
  //sync
  reducers: {
    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages = [...state.messages, action.payload];
    },
    removeMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter(msg => msg._id !== action.payload);
    },
    resetMessages: (state) => {
      state.messages = [];
    },
  },
  //async
  extraReducers: (builder) => {
    builder.addCase(fetchMessages.fulfilled, (state, action) => {
      if (action.payload) {
        state.messages = action.payload.messages;
      }
    });
  },
});

export const { setMessages, addMessage, removeMessage, resetMessages } = messagesSlice.actions;

export default messagesSlice.reducer;
