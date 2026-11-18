import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { checkAuth, logout as clearUser } from "@/store/slices/User";
import { queryClient } from "./queryClient";
import type { User } from "./types";

export const useLogin = () => {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<User>("/auth/login", input).then((r) => r.data),
    // Loads the workspace too, so routing knows whether to show onboarding.
    onSuccess: () => dispatch(checkAuth()).unwrap(),
  });
};

export const useRegister = () => {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (input: { fullName: string; email: string; password: string }) =>
      api.post("/auth/register", input),
    onSuccess: () => dispatch(checkAuth()).unwrap(),
  });
};

export const useLogout = () => {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: () => api.post("/auth/logout").catch(() => undefined),
    onSettled: () => {
      dispatch(clearUser());
      queryClient.clear(); // never show one user's cached data to the next
    },
  });
};

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (email: string) => api.post("/auth/forgot-password", { email }),
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: (input: { token: string; newPassword: string }) => api.post("/auth/reset-password", input),
  });

/** Which sign-in methods the server has turned on. */
export const useAuthProviders = () =>
  useQuery({
    queryKey: ["auth", "providers"],
    queryFn: () => api.get<{ google: boolean }>("/auth/providers").then((r) => r.data),
    staleTime: Infinity,
  });

/** Full-page redirect into Google's sign-in; the API sends the user back afterwards. */
export const googleSignInUrl = (opts: { invite?: string; next?: string } = {}) => {
  const params = new URLSearchParams();
  if (opts.invite) params.set("invite", opts.invite);
  if (opts.next) params.set("next", opts.next);
  const qs = params.toString();
  return `${import.meta.env.VITE_BACKEND_URL ?? ""}/api/auth/google${qs ? `?${qs}` : ""}`;
};
