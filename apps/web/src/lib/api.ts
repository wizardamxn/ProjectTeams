import axios, { AxiosError } from "axios";

// One HTTP client for the whole app. In production VITE_BACKEND_URL is empty
// (same origin, Nginx proxies /api); in dev it points at the API server.
export const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL ?? ""}/api`,
  // The API authenticates with an httpOnly cookie, so every request must send it.
  withCredentials: true,
});

type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;

/** Registered once by the store so this module doesn't import it (no cycles). */
export const setSessionExpiredHandler = (handler: SessionExpiredHandler) => {
  onSessionExpired = handler;
};

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const url = error.config?.url ?? "";
    // Auth calls and the initial session check are allowed to 401 quietly.
    const quiet = url.startsWith("/auth/") || url === "/profile/profile";
    if (error.response?.status === 401 && !quiet) onSessionExpired?.();
    return Promise.reject(error);
  },
);

/** The server's `{ message }` for an error, or a fallback. */
export const errorMessage = (error: unknown, fallback = "Something went wrong. Please try again.") => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    return data?.message ?? data?.error ?? fallback;
  }
  return fallback;
};
