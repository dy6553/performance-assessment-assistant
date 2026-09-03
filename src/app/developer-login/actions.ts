"use server";

import { redirect } from "next/navigation";

import { signInWithPassword, signOutCurrentUser } from "@/lib/supabase/server/auth";

export type DeveloperLoginState = { message: string };
const DEVELOPER_ID_RE = /^[a-zA-Z0-9_-]{3,32}$/;
const GPT_ADMIN_ID = "gpt-admin";

function developerEmail(developerId: string) {
  return `dev.${developerId.toLowerCase()}@performance-assessment.test.invalid`;
}

export async function developerLoginAction(
  _state: DeveloperLoginState,
  formData: FormData,
): Promise<DeveloperLoginState> {
  const developerId = String(formData.get("developerId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!DEVELOPER_ID_RE.test(developerId) || password.length < 8) {
    return { message: "개발자 ID 또는 비밀번호 형식을 확인해 주세요." };
  }

  const normalizedDeveloperId = developerId.toLowerCase();
  const result = await signInWithPassword(developerEmail(normalizedDeveloperId), password).catch(() => null);
  if (!result?.ok) {
    return { message: result?.status === 403 ? "아직 관리자 승인이 완료되지 않았습니다." : "개발자 ID 또는 비밀번호를 확인해 주세요." };
  }

  const storedDeveloperId = result.user.user_metadata?.developer_id;
  if (
    result.user.user_metadata?.account_type !== "developer_test" ||
    typeof storedDeveloperId !== "string" ||
    storedDeveloperId.toLowerCase() !== normalizedDeveloperId
  ) {
    await signOutCurrentUser();
    return { message: "개발자 테스트 계정이 아닙니다." };
  }

  redirect(normalizedDeveloperId === GPT_ADMIN_ID ? "/admin" : "/");
}
