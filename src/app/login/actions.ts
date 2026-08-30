"use server";

import { redirect } from "next/navigation";

import { loginSchema, signupSchema, type AuthFormState } from "@/features/auth/schemas";
import {
  signInWithPassword,
  signOutCurrentUser,
  signUpWithPassword,
} from "@/lib/supabase/server/auth";

export async function loginAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: String(formData.get("next") ?? ""),
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." };
  }

  const result = await signInWithPassword(parsed.data.email, parsed.data.password).catch(() => null);
  if (!result?.ok) return { message: "이메일 또는 비밀번호를 확인해 주세요." };

  redirect(safeNextPath(parsed.data.next));
}

export async function signupAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    nickname: formData.get("nickname"),
    email: formData.get("email"),
    password: formData.get("password"),
    next: String(formData.get("next") ?? ""),
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." };
  }

  const result = await signUpWithPassword(
    parsed.data.email,
    parsed.data.password,
    parsed.data.nickname,
  ).catch(() => null);

  if (!result?.ok) {
    return { message: "회원가입하지 못했습니다. 이미 가입한 이메일인지 확인해 주세요." };
  }

  if (result.needsEmailConfirmation) {
    return {
      message: "확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.",
      success: true,
    };
  }

  redirect(safeNextPath(parsed.data.next));
}

export async function logoutAction() {
  await signOutCurrentUser();
  redirect("/login");
}

function safeNextPath(next?: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/account";
  if (next.startsWith("/login")) return "/account";
  return next;
}
