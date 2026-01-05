import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

export const checkAuth = createAsyncThunk(
  "user/checkAuth",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get("/api/profile", {
        withCredentials: true,
      });
      return res.data;
    } catch (error) {
      return rejectWithValue("Not authenticated");
    }
  }
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.pending, (state) => {
        state.isAuthChecking = true;
      })
      .addCase(checkAuth.fulfilled, (state,action) => {
        state.isAuthChecking = false;
        state.user = action.payload;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isAuthChecking = false;
        state.user = null;
      });
  },
});

export const { addUser } = userSlice.actions;

export default userSlice.reducer;
