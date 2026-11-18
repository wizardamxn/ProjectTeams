import { z } from "zod";

export const PASSWORD_RULE = "Password must be at least 8 characters and include a letter and a number";

// Length matters more than symbol rules.
export const password = z
  .string({ required_error: PASSWORD_RULE })
  .min(8, PASSWORD_RULE)
  .max(128, "Password is too long")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), PASSWORD_RULE);

const email = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

export const loginSchema = z.object({
  email,
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export const registerSchema = z.object({
  fullName: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters"),
  email,
  password,
});

// Bad emails are not rejected here on purpose: forgot-password answers the same
// way for every input so it can't be used to discover accounts.
export const forgotPasswordSchema = z.object({ email: z.string().default("") });

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "This reset link is invalid or has expired"),
  newPassword: password,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
