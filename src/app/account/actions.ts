"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/supabase/server/auth";
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from "@/lib/supabase/server/profile";

export type ProfileFormState = {
  message: string;
  success?: boolean;
  schoolScopeChanged?: boolean;
};

export async function saveProfileAction(
  _state: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getAuthenticatedUser();
  if (!user) return { message: "로그인이 필요합니다." };

  const nickname = String(formData.get("nickname") ?? "").trim();
  const schoolName = String(formData.get("schoolName") ?? "").trim();
  const age = Number(formData.get("age"));

  if (nickname.length < 1 || nickname.length > 30) {
    return { message: "닉네임은 1~30자로 입력해 주세요." };
  }
  if (schoolName.length < 2 || schoolName.length > 120) {
    return { message: "학교 이름을 2~120자로 입력해 주세요." };
  }
  if (!Number.isInteger(age) || age < 6 || age > 100) {
    return { message: "나이를 올바르게 입력해 주세요." };
  }

  const before = await getCurrentUserProfile();

  try {
    await updateCurrentUserProfile({ nickname, schoolName, age });
  } catch {
    return { message: "사용자 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  const after = await getCurrentUserProfile();
  revalidatePath("/account");

  return {
    message: "사용자 정보를 저장했습니다.",
    success: true,
    schoolScopeChanged: (before?.school_key ?? "") !== (after?.school_key ?? ""),
  };
}
