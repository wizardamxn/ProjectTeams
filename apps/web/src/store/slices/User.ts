import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "@/lib/api";
import type { Me, Role, User, WorkspaceSummary } from "@/api/types";

/** Asks the API who is logged in and which workspace they're in (session = httpOnly cookie). */
export const checkAuth = createAsyncThunk("user/checkAuth", async (_, { rejectWithValue }) => {
  try {
    const res = await api.get<Me>("/me");
    return res.data;
  } catch {
    return rejectWithValue(null);
  }
});

interface UserState {
  user: User | null;
  workspace: { _id: string; name: string } | null;
  role: Role | null;
  workspaces: WorkspaceSummary[];
  isAuthChecking: boolean;
}

const initialState: UserState = {
  user: null,
  workspace: null,
  role: null,
  workspaces: [],
  isAuthChecking: true,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    logout: () => ({ ...initialState, isAuthChecking: false }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.pending, (state) => {
        // Only show the full-screen check on first load, not on re-checks.
        if (!state.user) state.isAuthChecking = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isAuthChecking = false;
        state.user = action.payload.user;
        state.workspace = action.payload.workspace;
        state.role = action.payload.role;
        state.workspaces = action.payload.workspaces;
      })
      .addCase(checkAuth.rejected, () => ({ ...initialState, isAuthChecking: false }));
  },
});

export const { logout } = userSlice.actions;
export default userSlice.reducer;

/** owner > admin > member */
export const isAtLeast = (role: Role | null, min: Role) =>
  role !== null && { owner: 3, admin: 2, member: 1 }[role] >= { owner: 3, admin: 2, member: 1 }[min];
