import { configureStore } from "@reduxjs/toolkit";
import userReducer, { logout } from "@/store/slices/User";
import chatReducer from "@/store/slices/SocketThunks";
import { setSessionExpiredHandler } from "@/lib/api";
import { queryClient } from "@/api/queryClient";

export const store = configureStore({
  reducer: {
    user: userReducer,
    chat: chatReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Session expired or revoked mid-use: drop the user and go back to login, once.
setSessionExpiredHandler(() => {
  if (!store.getState().user.user) return;
  store.dispatch(logout());
  queryClient.clear();
  if (window.location.pathname !== "/login") window.location.assign("/login?expired=1");
});
