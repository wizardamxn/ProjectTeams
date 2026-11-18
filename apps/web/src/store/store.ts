import { configureStore } from "@reduxjs/toolkit";
import userReducer, { checkAuth, logout } from "@/store/slices/User";
import { setSessionHandlers } from "@/lib/api";
import { queryClient } from "@/api/queryClient";

export const store = configureStore({
  reducer: {
    user: userReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

setSessionHandlers({
  // Session expired or revoked mid-use: drop the user and go back to login, once.
  onExpired: () => {
    if (!store.getState().user.user) return;
    store.dispatch(logout());
    queryClient.clear();
    if (window.location.pathname !== "/login") window.location.assign("/login?expired=1");
  },
  // Removed from the workspace: reload the session; routing then picks another
  // workspace or sends the user to onboarding.
  onNoWorkspace: () => {
    queryClient.clear();
    void store.dispatch(checkAuth());
  },
});
