import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { EMPTY_RELATIONSHIP, type RelationshipState } from '@motionmeet/shared';

/**
 * One shared answer to "where do I stand with this account", keyed by user id.
 *
 * Follow buttons appear on the feed, on profiles, in search, in Nearby and in
 * the suggestions rail. Without a shared store each of those kept its own copy
 * and they drifted apart the moment one of them acted. Socket
 * `relationship_changed` events land here too, so accepting a request on one
 * device updates every button on the other.
 */
interface RelationshipsState {
  byUserId: Record<string, RelationshipState>;
  /** User ids with a request in flight, so buttons can disable themselves. */
  pending: string[];
}

const initialState: RelationshipsState = { byUserId: {}, pending: [] };

const relationshipsSlice = createSlice({
  name: 'relationships',
  initialState,
  reducers: {
    setRelationship: (state, action: PayloadAction<{ userId: string; relationship: Partial<RelationshipState> }>) => {
      const { userId, relationship } = action.payload;
      state.byUserId[userId] = { ...EMPTY_RELATIONSHIP, ...state.byUserId[userId], ...relationship };
    },
    setRelationshipPending: (state, action: PayloadAction<{ userId: string; pending: boolean }>) => {
      const { userId, pending } = action.payload;
      state.pending = pending
        ? [...new Set([...state.pending, userId])]
        : state.pending.filter((id) => id !== userId);
    },
  },
});

export const { setRelationship, setRelationshipPending } = relationshipsSlice.actions;
export default relationshipsSlice.reducer;
