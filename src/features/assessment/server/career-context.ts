import "server-only";

import type { AssignmentInput, TopicRecommendationRequest } from "../schemas";
import { getCurrentUserProfile } from "@/lib/supabase/server/profile";

export type CareerAiContext = {
  interestField: string;
  desiredMajor: string;
  desiredCareer: string;
  notes: string;
};

export async function getCareerAiContext(): Promise<CareerAiContext | null> {
  const profile = await getCurrentUserProfile();
  if (!profile?.career_use_default) return null;

  const context: CareerAiContext = {
    interestField: profile.career_interest?.trim() ?? "",
    desiredMajor: profile.desired_major?.trim() ?? "",
    desiredCareer: profile.desired_career?.trim() ?? "",
    notes: profile.career_notes?.trim() ?? "",
  };

  return Object.values(context).some(Boolean) ? context : null;
}

export function applyCareerToTopicRequest(
  input: TopicRecommendationRequest,
  career: CareerAiContext | null,
): TopicRecommendationRequest {
  if (!career) return input;
  return {
    ...input,
    interestField: input.interestField || career.interestField,
    desiredMajor: input.desiredMajor || career.desiredMajor,
    desiredCareer: input.desiredCareer || career.desiredCareer,
    studentIdeas: appendCareerContext(input.studentIdeas, career),
  };
}

export function applyCareerToAssignment(
  assignment: AssignmentInput,
  career: CareerAiContext | null,
): AssignmentInput {
  if (!career) return assignment;
  return {
    ...assignment,
    studentIdeas: appendCareerContext(assignment.studentIdeas, career),
  };
}

export function careerContextForPrompt(career: CareerAiContext | null) {
  if (!career) return null;
  return {
    usagePolicy: "교사 안내·루브릭·교과 적합성을 우선하고, 자연스럽게 연결 가능한 경우에만 진로 정보를 참고한다. 억지로 진로와 연결하지 않는다.",
    관심진로분야: career.interestField,
    희망전공: career.desiredMajor,
    희망진로: career.desiredCareer,
    진로메모: career.notes,
  };
}

function appendCareerContext(original: string, career: CareerAiContext) {
  const lines = [
    career.interestField ? `관심 진로 분야: ${career.interestField}` : "",
    career.desiredMajor ? `희망 학과·전공: ${career.desiredMajor}` : "",
    career.desiredCareer ? `희망 직업·진로: ${career.desiredCareer}` : "",
    career.notes ? `진로 메모: ${career.notes}` : "",
  ].filter(Boolean);
  if (!lines.length) return original;

  const block = [
    "[사용자 프로필의 진로 참고 정보]",
    ...lines,
    "진로 정보는 교사 안내·루브릭·교과 적합성과 충돌하지 않고 자연스럽게 연결 가능한 경우에만 참고한다.",
  ].join("\n");

  return [original.trim(), block].filter(Boolean).join("\n\n").slice(0, 12_000);
}
