import axios, { AxiosError } from "axios";

// One HTTP client for the whole app. In production VITE_BACKEND_URL is empty
// (same origin, Nginx proxies /api); in dev it points at the API server.
export const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL ?? ""}/api`,
  // The API authenticates with an httpOnly cookie, so every request must send it.
  withCredentials: true,
});

interface SessionHandlers {
  /** Session expired or was revoked (401). */
  onExpired: () => void;
  /** You're no longer in the active workspace, e.g. you were removed (409 no_workspace). */
  onNoWorkspace: () => void;
}
let handlers: SessionHandlers | null = null;

/** Registered once by the store so this module doesn't import it (no cycles). */
export const setSessionHandlers = (h: SessionHandlers) => {
  handlers = h;
};

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ code?: string }>) => {
    const url = error.config?.url ?? "";
    const status = error.response?.status;
    // Auth calls and the session check itself are allowed to 401 quietly.
    const quiet = url.startsWith("/auth/") || url === "/me";
    if (status === 401 && !quiet) handlers?.onExpired();
    if (status === 409 && error.response?.data?.code === "no_workspace") handlers?.onNoWorkspace();
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
