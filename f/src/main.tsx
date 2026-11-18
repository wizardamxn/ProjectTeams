import { createRoot } from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import { store } from "./store/store";
import "./index.css";
import axios from "axios";
import { logout } from "./store/slices/User";

// The API authenticates with an httpOnly cookie, so every request must send it.
axios.defaults.withCredentials = true;

// Session expired or revoked: drop the user and go back to login, once.
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    const url: string = error.config?.url ?? "";
    const isAuthCall = url.includes("/api/auth/") || url.includes("/api/profile/profile");
    if (error.response?.status === 401 && !isAuthCall && store.getState().user.user) {
      store.dispatch(logout());
      if (window.location.pathname !== "/login") {
        window.location.assign("/login?expired=1");
      }
    }
    return Promise.reject(error);
  },
);

createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <App />
  </Provider>
);
