import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Notification, RelationshipState } from '@motionmeet/shared';
import {
  acceptFollowRequest,
  declineFollowRequest,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
} from '../../api/endpoints';

/**
 * Activity list plus the bell badge. Both the REST fetch and the live
 * `notification_received` socket event write here, so a second device sees a
 * like or a follow request without pulling to refresh.
 */
interface NotificationsState {
  items: Notification[];
  nextCursor: string | null;
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** Ids currently being confirmed or declined, so the row can disable itself. */
  respondingTo: string[];
}

const initialState: NotificationsState = {
  items: [],
  nextCursor: null,
  unreadCount: 0,
  loading: false,
  loadingMore: false,
  error: null,
  respondingTo: [],
};

export const fetchNotifications = createAsyncThunk<
  { items: Notification[]; nextCursor: string | null; unreadCount: number; append: boolean },
  { token: string; cursor?: string | null }
>('notifications/fetch', async ({ token, cursor = null }) => {
  const data = await getNotifications(token, cursor);
  if (!data.success) throw new Error(data.message || 'Notifications could not be loaded');
  return { items: data.items, nextCursor: data.nextCursor, unreadCount: data.unreadCount, append: Boolean(cursor) };
});

export const fetchUnreadCount = createAsyncThunk<number, string>(
  'notifications/unreadCount',
  async (token) => (await getUnreadNotificationCount(token)).unreadCount ?? 0,
);

export const markAllNotificationsRead = createAsyncThunk<void, string>(
  'notifications/markRead',
  async (token) => {
    await markNotificationsRead(token);
  },
);

export const respondToFollowRequest = createAsyncThunk<
  { requesterId: string; accepted: boolean; relationship: RelationshipState | null },
  { requesterId: string; token: string; accept: boolean }
>('notifications/respondToFollowRequest', async ({ requesterId, token, accept }) => {
  const data = accept
    ? await acceptFollowRequest(requesterId, token)
    : await declineFollowRequest(requesterId, token);
  if (!data.success) throw new Error(data.message || 'Follow request could not be updated');
  return { requesterId, accepted: accept, relationship: data.relationship ?? null };
});

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /** Live push from the socket. Replaces an existing row for the same id. */
    notificationReceived: (state, action: PayloadAction<{ notification: Notification; unreadCount: number }>) => {
      const { notification, unreadCount } = action.payload;
      state.items = [notification, ...state.items.filter((item) => item.id !== notification.id)];
      state.unreadCount = unreadCount;
    },
    /**
     * The other side answered a request, so any row still offering
     * Confirm/Delete for that person is stale.
     */
    followRequestResolved: (state, action: PayloadAction<{ userId: string }>) => {
      state.items = state.items.map((item) =>
        item.type === 'follow_request' && item.actor?._id === action.payload.userId
          ? { ...item, actionable: false }
          : item,
      );
    },
    clearNotifications: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state, action) => {
        if (action.meta.arg.cursor) state.loadingMore = true;
        else state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        const { items, nextCursor, unreadCount, append } = action.payload;
        if (append) {
          const known = new Set(state.items.map((item) => item.id));
          state.items.push(...items.filter((item) => !known.has(item.id)));
        } else {
          state.items = items;
        }
        state.nextCursor = nextCursor;
        state.unreadCount = unreadCount;
        state.loading = false;
        state.loadingMore = false;
        state.error = null;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.error.message ?? null;
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.unreadCount = 0;
        state.items = state.items.map((item) => ({ ...item, read: true }));
      })
      .addCase(respondToFollowRequest.pending, (state, action) => {
        state.respondingTo.push(action.meta.arg.requesterId);
      })
      .addCase(respondToFollowRequest.fulfilled, (state, action) => {
        state.respondingTo = state.respondingTo.filter((id) => id !== action.payload.requesterId);
        // Declining removes the row entirely; accepting keeps it as history but
        // stops offering the buttons.
        state.items = action.payload.accepted
          ? state.items.map((item) =>
              item.type === 'follow_request' && item.actor?._id === action.payload.requesterId
                ? { ...item, actionable: false }
                : item,
            )
          : state.items.filter(
              (item) => !(item.type === 'follow_request' && item.actor?._id === action.payload.requesterId),
            );
      })
      .addCase(respondToFollowRequest.rejected, (state, action) => {
        state.respondingTo = state.respondingTo.filter((id) => id !== action.meta.arg.requesterId);
        state.error = action.error.message ?? null;
      });
  },
});

export const { notificationReceived, followRequestResolved, clearNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
