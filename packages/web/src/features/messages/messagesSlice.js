import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "~/api/axios";
import { API_ROUTES } from "@motionmeet/shared";

const initialState = {
  messages: [],
};

export const fetchMessages = createAsyncThunk(
  "messages/fetchMessages",
  async ({ token, userId }) => {
    const { data } = await api.post(
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
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    addMessage: (state, action) => {
      state.messages = [...state.messages, action.payload];
    },
    removeMessage: (state, action) => {
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
