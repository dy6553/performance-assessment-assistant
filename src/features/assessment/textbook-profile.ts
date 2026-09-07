import type { AssignmentInput, TopicRecommendationRequest } from "./schemas";

export const TEXTBOOK_PROFILE_COOKIE = "paa_textbook_profiles_v1";
export const TEXTBOOK_PROFILE_STORAGE_KEY = "performance-assistant:textbook-profiles:v1";
export const MAX_TEXTBOOK_PROFILES = 6;

export type TextbookProfile = {
  id: string;
  curriculum: AssignmentInput["curriculum"];
  schoolLevel: AssignmentInput["schoolLevel"];
  grade: number;
  subject: string;
  course: string;
  publisher: string;
  textbookTitle: string;
  unit: string;
  pages: string;
};

type CompactProfile = {
  i: string;
  c: TextbookProfile["curriculum"];
  l: TextbookProfile["schoolLevel"];
  g: number;
  s: string;
  o: string;
  p: string;
  t: string;
  u: string;
  r: string;
};

export function sanitizeTextbookProfiles(value: unknown): TextbookProfile[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(sanitizeProfile)
    .filter((profile): profile is TextbookProfile => Boolean(profile))
    .slice(0, MAX_TEXTBOOK_PROFILES);
}

export function serializeTextbookProfiles(profiles: TextbookProfile[]): string {
  return JSON.stringify(sanitizeTextbookProfiles(profiles).map<CompactProfile>((profile) => ({
    i: profile.id,
    c: profile.curriculum,
    l: profile.schoolLevel,
    g: profile.grade,
    s: profile.subject,
    o: profile.course,
    p: profile.publisher,
    t: profile.textbookTitle,
    u: profile.unit,
    r: profile.pages,
  })));
}

export function parseTextbookProfiles(serialized: string | null | undefined): TextbookProfile[] {
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sanitizeTextbookProfiles(parsed.map((item) => {
      if (!item || typeof item !== "object") return item;
      const compact = item as Partial<CompactProfile>;
      if (!("s" in compact)) return item;
      return {
        id: compact.i,
        curriculum: compact.c,
        schoolLevel: compact.l,
        grade: compact.g,
        subject: compact.s,
        course: compact.o,
        publisher: compact.p,
        textbookTitle: compact.t,
        unit: compact.u,
        pages: compact.r,
      };
    }));
  } catch {
    return [];
  }
}

export function readTextbookProfilesFromCookieHeader(cookieHeader: string | null): TextbookProfile[] {
  if (!cookieHeader) return [];
  const prefix = `${TEXTBOOK_PROFILE_COOKIE}=`;
  const entry = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!entry) return [];
  try {
    return parseTextbookProfiles(decodeURIComponent(entry.slice(prefix.length)));
  } catch {
    return [];
  }
}

export function findTextbookProfile(
  profiles: TextbookProfile[],
  input: Pick<AssignmentInput, "curriculum" | "schoolLevel" | "grade" | "subject" | "course">,
): TextbookProfile | undefined {
  const subject = normalize(input.subject);
  const course = normalize(input.course || "");
  const candidates = profiles.filter((profile) =>
    profile.curriculum === input.curriculum
    && profile.schoolLevel === input.schoolLevel
    && profile.grade === input.grade,
  );
  return candidates.find((profile) => normalize(profile.subject) === subject && (!profile.course || !course || normalize(profile.course) === course))
    ?? candidates.find((profile) => {
      const profileSubject = normalize(profile.subject);
      return profileSubject.length >= 2 && (subject.includes(profileSubject) || profileSubject.includes(subject));
    });
}

export function applyTextbookProfileToAssignment(
  assignment: AssignmentInput,
  cookieHeader: string | null,
): AssignmentInput {
  const profile = findTextbookProfile(readTextbookProfilesFromCookieHeader(cookieHeader), assignment);
  if (!profile) return assignment;
  const context = buildTextbookRequirement(profile);
  return {
    ...assignment,
    requiredElements: appendContext(assignment.requiredElements, context, 8_000),
  };
}

export function applyTextbookProfileToTopicRequest(
  input: TopicRecommendationRequest,
  cookieHeader: string | null,
): TopicRecommendationRequest {
  const profile = findTextbookProfile(readTextbookProfilesFromCookieHeader(cookieHeader), input);
  if (!profile) return input;
  return {
    ...input,
    additionalConditions: appendContext(input.additionalConditions, buildTextbookRequirement(profile), 2_000),
  };
}

export function buildTextbookRequirement(profile: TextbookProfile): string {
  return [
    "[교과서·교육과정 반영 기준]",
    `교육과정: ${profile.curriculum}`,
    `학교급/학년: ${profile.schoolLevel} ${profile.grade}학년`,
    `과목: ${profile.subject}${profile.course ? ` / 세부과목: ${profile.course}` : ""}`,
    `출판사: ${profile.publisher}`,
    `교과서: ${profile.textbookTitle}`,
    profile.unit ? `단원: ${profile.unit}` : "단원: 별도 지정 없음",
    profile.pages ? `쪽수: ${profile.pages}` : "쪽수: 별도 지정 없음",
    "교과서명·출판사명만으로 실제 본문, 예제, 활동, 문장, 수치, 쪽별 내용을 만들어내지 않는다.",
    "사용자가 과제 안내 입력이나 첨부 자료로 제공한 교과서 페이지·발췌·사진 분석 내용이 있으면 그 실제 내용을 우선 근거로 삼고, 지정 단원·쪽수와 교육과정 범위를 벗어나지 않게 결과물을 작성한다.",
    "실제 교과서 본문이 제공되지 않았다면 교육과정과 교과서 메타데이터를 범위 확인용으로만 사용하며, 교과서 원문을 직접 확인했다고 표현하지 않는다.",
  ].join("\n");
}

function appendContext(existing: string, context: string, maxLength: number): string {
  const marker = "[교과서·교육과정 반영 기준]";
  if (existing.includes(marker)) return existing.slice(0, maxLength);
  if (context.length >= maxLength) return context.slice(0, maxLength);
  const availableForExisting = Math.max(0, maxLength - context.length - 2);
  const prefix = existing.trim().slice(0, availableForExisting);
  return prefix ? `${prefix}\n\n${context}` : context;
}

function sanitizeProfile(value: unknown): TextbookProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<TextbookProfile>;
  const curriculum = raw.curriculum === "2022 개정 교육과정" || raw.curriculum === "2015 개정 교육과정" ? raw.curriculum : null;
  const schoolLevel = raw.schoolLevel === "초등학교" || raw.schoolLevel === "중학교" || raw.schoolLevel === "고등학교" ? raw.schoolLevel : null;
  const grade = Number(raw.grade);
  const maxGrade = schoolLevel === "초등학교" ? 6 : 3;
  const subject = clean(raw.subject, 40);
  const publisher = clean(raw.publisher, 40);
  const textbookTitle = clean(raw.textbookTitle, 80);
  if (!curriculum || !schoolLevel || !Number.isInteger(grade) || grade < 1 || grade > maxGrade || !subject || !publisher || !textbookTitle) return null;
  return {
    id: clean(raw.id, 80) || `${Date.now()}-${subject}`,
    curriculum,
    schoolLevel,
    grade,
    subject,
    course: clean(raw.course, 80),
    publisher,
    textbookTitle,
    unit: clean(raw.unit, 100),
    pages: clean(raw.pages, 40),
  };
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function normalize(value: string): string {
  return value.replace(/[\s·ⅠⅡⅢIVV0-9()_-]+/g, "").toLocaleLowerCase("ko-KR");
}
