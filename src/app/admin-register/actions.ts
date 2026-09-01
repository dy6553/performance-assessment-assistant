"use server";

import { redirect } from "next/navigation";

import { signUpWithPassword } from "@/lib/supabase/server/auth";

export type AdminRegisterState = { message: string; success?: boolean };

function superAdminEmails() {
  return new Set(
    (process.env.SUPER_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  );
}

export async function adminRegisterAction(
  _state: AdminRegisterState,
  formData: FormData,
): Promise<AdminRegisterState> {
  const email = String(formData.get("email") ?? "").trim().toLocaleLowerCase("en-US");
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) return { message: "관리자 이메일을 확인해 주세요." };
  if (password.length < 8) return { message: "비밀번호는 8자리 이상이어야 합니다." };
  if (!superAdminEmails().has(email)) {
    return { message: "등록된 최고 관리자 이메일이 아닙니다." };
  }

  const result = await signUpWithPassword(email, password, "관리자").catch(() => null);
  if (!result?.ok) {
    return { message: "관리자 계정을 만들지 못했습니다. 이미 가입된 이메일인지 확인해 주세요." };
  }
  if (result.needsEmailConfirmation) {
    return { message: "확인 메일을 보냈습니다. 이메일 인증 후 관리자 로그인을 해 주세요.", success: true };
  }

  redirect("/admin");
}
