import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const backendURL = import.meta.env.VITE_BACKEND_URL;
export const checkAuth = createAsyncThunk(
  "user/checkAuth",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${backendURL}/profile`, {
        withCredentials: true,
      });
      return res.data;
    } catch {
      return rejectWithValue(null);
    }
  },
);

const userSlice = createSlice({
  name: "user",
  initialState: {
    user: null,
    isAuthChecking: true,
  },
  reducers: {
    addUser: (state, action) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.user = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.pending, (state) => {
        state.isAuthChecking = true;
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
