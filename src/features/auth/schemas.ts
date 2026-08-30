import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("올바른 이메일 주소를 입력해 주세요.").trim(),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(128),
  next: z.string().optional(),
});

export const signupSchema = loginSchema.extend({
  nickname: z.string().trim().min(2, "닉네임은 2자 이상이어야 합니다.").max(30),
});

export type AuthFormState = {
  message: string;
  success?: boolean;
};
