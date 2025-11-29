import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/axios";
import { dummyUserData } from "../../assets/assets";

const initialState = {
    value: dummyUserData, // Start with dummy data for demo
    loading: false,
    error: null,
};

export const fetchUser = createAsyncThunk("user/fetchUser", async (token) => {
    try {
        const { data } = await api.get("/api/user/data", {
            headers: { Authorization: `Bearer ${token}` },
        });
        return data.success ? data.user : null;
    } catch (error) {
        console.log("Error fetching user:", error);
        return null;
    }
});

export const updateUser = createAsyncThunk(
    "user/update",
    async ({ userData, token }) => {
        try {
            const { data } = await api.post("/api/user/update", userData, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (data.success) {
                return data.user;
            } else {
                return null;
            }
        } catch (error) {
            console.log("Error updating user:", error);
            return null;
        }
    }
);

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action) => {
            state.value = action.payload;
        },
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
                state.loading = false;
                if (action.payload) {
                    state.value = action.payload;
                }
            })
            .addCase(fetchUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message;
            })
            .addCase(updateUser.fulfilled, (state, action) => {
                if (action.payload) {
                    state.value = action.payload;
                }
            });
    },
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
