import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getUserData } from "../../api/endpoints";
import type { User } from '@motionmeet/shared';

interface UserState { value: User | null; loading: boolean; error: string | null }
interface UpdateUserArgument { userData: FormData | Record<string, unknown>; token: string }

const initialState: UserState = {
  value: null,
  loading: false,
  error: null,
};

export const fetchUser = createAsyncThunk<User | null, string>("user/fetchUser", async (token) => {
  const data = await getUserData(token);
  return data.success ? data.user : null;
});

export const updateUser = createAsyncThunk<User, UpdateUserArgument, { rejectValue: string }>(
  "user/update",
  async ({ userData, token }, { rejectWithValue }) => {
    try {
      const { updateUserProfile } = await import("../../api/endpoints");
      const data = await updateUserProfile(userData, token);
      if (data.success) return data.user;
      return rejectWithValue(data.message || "Profile update failed");
    } catch (error: unknown) {
      return rejectWithValue(
        (error instanceof Error ? error.message : undefined) ||
        "Profile update failed",
      );
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearUser: (state) => {
      state.value = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.value = action.payload;
        state.loading = false;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? null;
      })
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.value = action.payload;
        state.loading = false;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message || null;
      });
  },
});

export const { clearUser } = userSlice.actions;
export default userSlice.reducer;
