import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import toast from "react-hot-toast";
import api from "~/api/axios.js";
import { API_ROUTES, type User, type UserUpdateInput } from "@motionmeet/shared";

interface UserState { value: User | null }
interface UserResponse { success: boolean; user?: User; message?: string }
interface UpdateUserArgument { userData: UserUpdateInput | FormData; token: string }

const initialState: UserState = {
  value: null,
};

export const fetchUser = createAsyncThunk<User | null, string>("user/fetchUser", async (token) => {
  const { data } = await api.get<UserResponse>(API_ROUTES.user.data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.success ? data.user ?? null : null;
});

export const updateUser = createAsyncThunk(
  "user/update",
  async ({ userData, token }: UpdateUserArgument): Promise<User | null> => {
    const { data } = await api.post<UserResponse>(API_ROUTES.user_extras.update, userData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data.success) {
      toast.success(data.message ?? "Profile updated");
      return data.user ?? null;
    } else {
      toast.error(data.message ?? "Profile update failed");
      return null;
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.value = action.payload;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.value = action.payload;
      });
  },
});

export default userSlice.reducer;
