import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { addUser, checkAuth, logout as clearUser } from "@/store/slices/User";
import { queryClient } from "./queryClient";
import type { User } from "./types";

export const useLogin = () => {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<User>("/auth/login", input).then((r) => r.data),
    onSuccess: (user) => {
      dispatch(addUser(user));
    },
  });
};

export const useRegister = () => {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (input: { fullName: string; email: string; password: string; teamCode: string }) =>
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
