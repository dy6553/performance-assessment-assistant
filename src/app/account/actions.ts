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
  const [user, before] = await Promise.all([
    getAuthenticatedUser(),
    getCurrentUserProfile(),
  ]);
  if (!user) return { message: "로그인이 필요합니다." };

  const nickname = String(formData.get("nickname") ?? "").trim();
  const schoolName = String(formData.get("schoolName") ?? "").trim();
  const age = Number(formData.get("age"));
  const careerInterest = String(formData.get("careerInterest") ?? "").trim();
  const desiredMajor = String(formData.get("desiredMajor") ?? "").trim();
  const desiredCareer = String(formData.get("desiredCareer") ?? "").trim();
  const careerNotes = String(formData.get("careerNotes") ?? "").trim();
  const careerUseDefault = formData.get("careerUseDefault") === "on";

  if (nickname.length < 1 || nickname.length > 30) {
    return { message: "닉네임은 1~30자로 입력해 주세요." };
  }
  if (schoolName.length < 2 || schoolName.length > 120) {
    return { message: "학교 이름을 2~120자로 입력해 주세요." };
  }
  if (!Number.isInteger(age) || age < 6 || age > 100) {
    return { message: "나이를 올바르게 입력해 주세요." };
  }
  if (careerInterest.length > 500) return { message: "관심 진로 분야는 500자 이하로 입력해 주세요." };
  if (desiredMajor.length > 300) return { message: "희망 전공은 300자 이하로 입력해 주세요." };
  if (desiredCareer.length > 300) return { message: "희망 진로는 300자 이하로 입력해 주세요." };
  if (careerNotes.length > 1500) return { message: "진로 메모는 1,500자 이하로 입력해 주세요." };

  try {
    await updateCurrentUserProfile({
      nickname,
      schoolName,
      age,
      careerInterest,
      desiredMajor,
      desiredCareer,
      careerNotes,
      careerUseDefault,
    });
  } catch {
    return { message: "사용자 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  const after = await getCurrentUserProfile();
  revalidatePath("/account");

  return {
    message: careerUseDefault
      ? "사용자 정보와 진로 정보를 저장했습니다. 앞으로 AI 수행평가 작업에서 적합할 때 진로 정보를 참고합니다."
      : "사용자 정보와 진로 정보를 저장했습니다.",
    success: true,
    schoolScopeChanged: (before?.school_key ?? "") !== (after?.school_key ?? ""),
  };
}
