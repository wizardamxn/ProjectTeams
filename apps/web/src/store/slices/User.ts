import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { api } from "@/lib/api";
import type { User } from "@/api/types";

/** Asks the API who is logged in (the session lives in an httpOnly cookie). */
export const checkAuth = createAsyncThunk("user/checkAuth", async (_, { rejectWithValue }) => {
  try {
    const res = await api.get<User>("/profile/profile");
    return res.data;
  } catch {
    return rejectWithValue(null);
  }
});

interface UserState {
  user: User | null;
  isAuthChecking: boolean;
}

const initialState: UserState = { user: null, isAuthChecking: true };

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    addUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.user = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.pending, (state) => {
        // Only show the full-screen check on first load, not on re-checks after login.
        if (!state.user) state.isAuthChecking = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isAuthChecking = false;
        state.user = action.payload;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isAuthChecking = false;
        state.user = null;
      });
  },
});

export const { addUser, logout } = userSlice.actions;
export default userSlice.reducer;
