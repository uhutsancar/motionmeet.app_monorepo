import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getMessages } from '../../api/endpoints';
import { type PayloadAction } from '@reduxjs/toolkit';
import { applySyncPage as applySyncPageToList, markSeenUpTo, mergeMessages, type Message, type MessageSyncResult, type PublicUser } from '@motionmeet/shared';

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
    /**
     * Folds the newest page back in after the socket was down - the app in the
     * background, a network change - so messages sent meanwhile appear without
     * reopening the chat. Known messages are refreshed in place (their seen
     * flag may have changed), new ones are added, and the list stays in
     * send order.
     */
    mergeLatestMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = mergeMessages(state.messages, action.payload);
    },
    /** One page of a message sync (ADR 005): new messages in, deleted ones out, own messages marked read. */
    applySyncPage: (state, action: PayloadAction<{ page: Pick<MessageSyncResult, 'messages' | 'deletedMessageIds' | 'partnerLastReadSeq'>; selfId: string }>) => {
      state.messages = applySyncPageToList(state.messages, action.payload.page, action.payload.selfId);
    },
    /** The partner has read every message to them up to `lastReadSeq`. */
    markOwnMessagesSeenUpTo: (state, action: PayloadAction<{ selfId: string; lastReadSeq: number }>) => {
      state.messages = markSeenUpTo(state.messages, action.payload.selfId, action.payload.lastReadSeq);
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
  mergeLatestMessages,
  applySyncPage,
  markOwnMessagesSeenUpTo,
  removeMessage,
  markMessagesSeenByUser,
} = messagesSlice.actions;
export default messagesSlice.reducer;
