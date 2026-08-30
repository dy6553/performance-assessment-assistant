export type ThemePreference = "light" | "dark";
export type FontSizePreference = "small" | "default" | "large";
export type StartPagePreference = "home" | "auto" | "report" | "presentation" | "experiment";
export type CacheCleanupDays = "off" | "7" | "30" | "90";
export type CacheLimitMb = "off" | "50" | "100" | "250";
export type FileNameFormat = "title" | "title_date";
export type FileNameSeparator = "_" | "-" | " ";

export const THEME_KEY = "assessment-theme";
export const FONT_SIZE_KEY = "assessment-font-size";
export const REDUCE_MOTION_KEY = "assessment-reduce-motion";
export const HIGH_CONTRAST_KEY = "assessment-high-contrast";
export const LARGE_CONTROLS_KEY = "assessment-large-controls";
export const HAPTIC_KEY = "assessment-haptics";
export const NOTIFICATION_KEY = "assessment-notifications";
export const DATA_SAVER_KEY = "assessment-data-saver";
export const FAST_RESPONSE_KEY = "assessment-fast-response";
export const WAKE_KEY = "assessment-keep-awake";
export const START_PAGE_KEY = "assessment-start-page";
export const START_SESSION_KEY = "assessment-start-page-applied";
export const SETTINGS_IMPORT_NOTICE_KEY = "assessment-settings-imported";

export const DEFAULT_CURRICULUM_KEY = "assessment-default-curriculum";
export const DEFAULT_SCHOOL_LEVEL_KEY = "assessment-default-school-level";
export const DEFAULT_GRADE_KEY = "assessment-default-grade";
export const DEFAULT_SUBJECT_KEY = "assessment-default-subject";
export const DEFAULT_ASSIGNMENT_TYPE_KEY = "assessment-default-assignment-type";

export const FILE_NAME_FORMAT_KEY = "assessment-file-name-format";
export const FILE_NAME_PREFIX_KEY = "assessment-file-name-prefix";
export const FILE_NAME_SEPARATOR_KEY = "assessment-file-name-separator";
export const FILE_NAME_EXAMPLE_KEY = "assessment-file-name-example";

export const CACHE_CLEANUP_DAYS_KEY = "assessment-cache-cleanup-days";
export const CACHE_LIMIT_MB_KEY = "assessment-cache-limit-mb";
export const CACHE_LAST_CLEANUP_KEY = "assessment-cache-last-cleanup";

export const SETTINGS_BACKUP_KEYS = [
  THEME_KEY,
  FONT_SIZE_KEY,
  REDUCE_MOTION_KEY,
  HIGH_CONTRAST_KEY,
  LARGE_CONTROLS_KEY,
  HAPTIC_KEY,
  NOTIFICATION_KEY,
  DATA_SAVER_KEY,
  FAST_RESPONSE_KEY,
  WAKE_KEY,
  START_PAGE_KEY,
  DEFAULT_CURRICULUM_KEY,
  DEFAULT_SCHOOL_LEVEL_KEY,
  DEFAULT_GRADE_KEY,
  DEFAULT_SUBJECT_KEY,
  DEFAULT_ASSIGNMENT_TYPE_KEY,
  FILE_NAME_FORMAT_KEY,
  FILE_NAME_PREFIX_KEY,
  FILE_NAME_SEPARATOR_KEY,
  FILE_NAME_EXAMPLE_KEY,
  CACHE_CLEANUP_DAYS_KEY,
  CACHE_LIMIT_MB_KEY,
] as const;

export type AssignmentDefaultPreferences = {
  curriculum: "2022 개정 교육과정" | "2015 개정 교육과정";
  schoolLevel: "초등학교" | "중학교" | "고등학교";
  grade: number;
  subject: string;
  assignmentType: "자동 분석" | "조사·보고서" | "발표·토론" | "실험·탐구";
};

export const defaultAssignmentPreferences: AssignmentDefaultPreferences = {
  curriculum: "2022 개정 교육과정",
  schoolLevel: "고등학교",
  grade: 1,
  subject: "",
  assignmentType: "자동 분석",
};

export function safeFontSize(value: string | null): FontSizePreference {
  return value === "small" || value === "large" ? value : "default";
}

export function safeStartPage(value: string | null): StartPagePreference {
  return value === "auto" || value === "report" || value === "presentation" || value === "experiment" ? value : "home";
}

export function safeCleanupDays(value: string | null): CacheCleanupDays {
  return value === "7" || value === "30" || value === "90" ? value : "off";
}

export function safeCacheLimit(value: string | null): CacheLimitMb {
  return value === "50" || value === "100" || value === "250" ? value : "off";
}

export function safeFileNameFormat(value: string | null): FileNameFormat {
  return value === "title_date" ? "title_date" : "title";
}

export function safeFileNameSeparator(value: string | null): FileNameSeparator {
  return value === "-" || value === " " ? value : "_";
}

export function readAssignmentDefaultPreferences(): AssignmentDefaultPreferences {
  if (typeof window === "undefined") return defaultAssignmentPreferences;

  const curriculumRaw = localStorage.getItem(DEFAULT_CURRICULUM_KEY);
  const curriculum = curriculumRaw === "2015 개정 교육과정" ? "2015 개정 교육과정" : "2022 개정 교육과정";

  const schoolRaw = localStorage.getItem(DEFAULT_SCHOOL_LEVEL_KEY);
  const schoolLevel = schoolRaw === "초등학교" || schoolRaw === "중학교" ? schoolRaw : "고등학교";
  const maxGrade = schoolLevel === "초등학교" ? 6 : 3;
  const gradeRaw = Number(localStorage.getItem(DEFAULT_GRADE_KEY));
  const grade = Number.isInteger(gradeRaw) ? Math.min(Math.max(gradeRaw, 1), maxGrade) : 1;

  const subjectRaw = localStorage.getItem(DEFAULT_SUBJECT_KEY)?.trim();
  const subject = subjectRaw ? subjectRaw.slice(0, 80) : defaultAssignmentPreferences.subject;

  const typeRaw = localStorage.getItem(DEFAULT_ASSIGNMENT_TYPE_KEY);
  const assignmentType = typeRaw === "조사·보고서" || typeRaw === "발표·토론" || typeRaw === "실험·탐구"
    ? typeRaw
    : "자동 분석";

  return { curriculum, schoolLevel, grade, subject, assignmentType };
}
