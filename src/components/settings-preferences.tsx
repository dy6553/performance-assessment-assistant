"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { InstallAppButton } from "@/components/install-app-button";
import { assignmentTypeOptions } from "@/features/assessment/assessment-flow";
import {
  CACHE_CLEANUP_DAYS_KEY,
  CACHE_LAST_CLEANUP_KEY,
  CACHE_LIMIT_MB_KEY,
  DATA_SAVER_KEY,
  DEFAULT_ASSIGNMENT_TYPE_KEY,
  DEFAULT_CURRICULUM_KEY,
  DEFAULT_GRADE_KEY,
  DEFAULT_SCHOOL_LEVEL_KEY,
  DEFAULT_SUBJECT_KEY,
  FAST_RESPONSE_KEY,
  FILE_NAME_EXAMPLE_KEY,
  FILE_NAME_FORMAT_KEY,
  FILE_NAME_PREFIX_KEY,
  FILE_NAME_SEPARATOR_KEY,
  FONT_SIZE_KEY,
  HAPTIC_KEY,
  HIGH_CONTRAST_KEY,
  LARGE_CONTROLS_KEY,
  NOTIFICATION_KEY,
  REDUCE_MOTION_KEY,
  SETTINGS_BACKUP_KEYS,
  SETTINGS_IMPORT_NOTICE_KEY,
  START_PAGE_KEY,
  START_SESSION_KEY,
  THEME_KEY,
  WAKE_KEY,
  defaultAssignmentPreferences,
  safeCacheLimit,
  safeCleanupDays,
  safeFileNameFormat,
  safeFileNameSeparator,
  safeFontSize,
  safeStartPage,
  type CacheCleanupDays,
  type CacheLimitMb,
  type FileNameFormat,
  type FileNameSeparator,
  type FontSizePreference,
  type StartPagePreference,
  type ThemePreference,
} from "@/lib/client-preferences";

export type SettingsSection =
  | "generation"
  | "files"
  | "display"
  | "accessibility"
  | "behavior"
  | "notifications"
  | "navigation"
  | "devices"
  | "storage"
  | "backup"
  | "about"
  | "misc"
  | "connections";

export type ConnectionStatus = {
  name: string;
  connected: boolean;
  description: string;
};

type SchoolLevel = "초등학교" | "중학교" | "고등학교";
type Curriculum = "2022 개정 교육과정" | "2015 개정 교육과정";
type AssignmentType = "자동 분석" | "조사·보고서" | "발표·토론" | "실험·탐구";

const currentSessionKeys = [
  "assessment-wizard-draft-v1",
  "assessment-wizard-analysis-v1",
  "assessment-wizard-generated-draft-v1",
  "assessment-wizard-verification-v1",
] as const;

export function SettingsPreferences({
  section,
  connections = [],
  appVersion = "0.1.0",
}: {
  section: SettingsSection;
  connections?: ConnectionStatus[];
  appVersion?: string;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [fontSize, setFontSize] = useState<FontSizePreference>("default");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeControls, setLargeControls] = useState(false);
  const [fastResponse, setFastResponse] = useState(false);
  const [haptics, setHaptics] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
  const [keepAwake, setKeepAwake] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [startPage, setStartPage] = useState<StartPagePreference>("home");
  const [curriculum, setCurriculum] = useState<Curriculum>(defaultAssignmentPreferences.curriculum);
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>(defaultAssignmentPreferences.schoolLevel);
  const [grade, setGrade] = useState(defaultAssignmentPreferences.grade);
  const [subject, setSubject] = useState(defaultAssignmentPreferences.subject);
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(defaultAssignmentPreferences.assignmentType);
  const [fileFormat, setFileFormat] = useState<FileNameFormat>("title");
  const [filePrefix, setFilePrefix] = useState("");
  const [fileSeparator, setFileSeparator] = useState<FileNameSeparator>("_");
  const [fileExample, setFileExample] = useState("");
  const [cleanupDays, setCleanupDays] = useState<CacheCleanupDays>("off");
  const [cacheLimit, setCacheLimit] = useState<CacheLimitMb>("off");
  const [resetRequested, setResetRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [supportsHaptics, setSupportsHaptics] = useState(true);
  const [supportsNotifications, setSupportsNotifications] = useState(true);
  const [supportsWakeLock, setSupportsWakeLock] = useState(true);
  const [storageUsage, setStorageUsage] = useState<number | null>(null);
  const [storageQuota, setStorageQuota] = useState<number | null>(null);
  const [cacheCount, setCacheCount] = useState<number | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);

  const maxGrade = schoolLevel === "초등학교" ? 6 : 3;
  const gradeOptions = useMemo(() => Array.from({ length: maxGrade }, (_, index) => index + 1), [maxGrade]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTheme(localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");
      setFontSize(safeFontSize(localStorage.getItem(FONT_SIZE_KEY)));
      setReduceMotion(localStorage.getItem(REDUCE_MOTION_KEY) === "1");
      setHighContrast(localStorage.getItem(HIGH_CONTRAST_KEY) === "1");
      setLargeControls(localStorage.getItem(LARGE_CONTROLS_KEY) === "1");
      setFastResponse(localStorage.getItem(FAST_RESPONSE_KEY) === "1");
      setHaptics(localStorage.getItem(HAPTIC_KEY) === "1");
      setDataSaver(localStorage.getItem(DATA_SAVER_KEY) === "1");
      setKeepAwake(localStorage.getItem(WAKE_KEY) === "1");
      setNotifications(localStorage.getItem(NOTIFICATION_KEY) === "1");
      setStartPage(safeStartPage(localStorage.getItem(START_PAGE_KEY)));

      const curriculumRaw = localStorage.getItem(DEFAULT_CURRICULUM_KEY);
      setCurriculum(curriculumRaw === "2015 개정 교육과정" ? "2015 개정 교육과정" : "2022 개정 교육과정");
      const schoolRaw = localStorage.getItem(DEFAULT_SCHOOL_LEVEL_KEY);
      const nextSchool: SchoolLevel = schoolRaw === "초등학교" || schoolRaw === "중학교" ? schoolRaw : "고등학교";
      setSchoolLevel(nextSchool);
      const nextMaxGrade = nextSchool === "초등학교" ? 6 : 3;
      const gradeRaw = Number(localStorage.getItem(DEFAULT_GRADE_KEY));
      setGrade(Number.isInteger(gradeRaw) ? Math.min(Math.max(gradeRaw, 1), nextMaxGrade) : 1);
      setSubject(localStorage.getItem(DEFAULT_SUBJECT_KEY)?.trim() || defaultAssignmentPreferences.subject);
      const typeRaw = localStorage.getItem(DEFAULT_ASSIGNMENT_TYPE_KEY);
      setAssignmentType(typeRaw === "조사·보고서" || typeRaw === "발표·토론" || typeRaw === "실험·탐구" ? typeRaw : "자동 분석");

      setFileFormat(safeFileNameFormat(localStorage.getItem(FILE_NAME_FORMAT_KEY)));
      setFilePrefix(localStorage.getItem(FILE_NAME_PREFIX_KEY) ?? "");
      setFileSeparator(safeFileNameSeparator(localStorage.getItem(FILE_NAME_SEPARATOR_KEY)));
      setFileExample(localStorage.getItem(FILE_NAME_EXAMPLE_KEY) ?? "");
      setCleanupDays(safeCleanupDays(localStorage.getItem(CACHE_CLEANUP_DAYS_KEY)));
      setCacheLimit(safeCacheLimit(localStorage.getItem(CACHE_LIMIT_MB_KEY)));

      setSupportsHaptics("vibrate" in navigator);
      setSupportsNotifications("Notification" in window);
      setSupportsWakeLock("wakeLock" in navigator);

      if (sessionStorage.getItem(SETTINGS_IMPORT_NOTICE_KEY) === "1") {
        sessionStorage.removeItem(SETTINGS_IMPORT_NOTICE_KEY);
        setMessage("설정 백업을 복원했습니다.");
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (section !== "storage") return;
    const frame = window.requestAnimationFrame(() => void refreshStorage());
    return () => window.cancelAnimationFrame(frame);
  }, [section]);

  function preferenceChanged() {
    window.dispatchEvent(new Event("assessment-preference-change"));
  }

  function applyVisualPreferences() {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.fontSize = fontSize;
    root.dataset.reduceMotion = reduceMotion ? "true" : "false";
    root.dataset.highContrast = highContrast ? "true" : "false";
    root.dataset.largeControls = largeControls ? "true" : "false";
    root.dataset.fastResponse = fastResponse ? "true" : "false";
    root.dataset.dataSaver = dataSaver ? "true" : "false";
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#111827" : "#f8fafc");
    window.dispatchEvent(new Event("assessment-theme-change"));
    preferenceChanged();
  }

  function stageFastResponse(enabled: boolean) {
    setFastResponse(enabled);
    if (enabled) setDataSaver(false);
    setMessage("");
  }

  function stageDataSaver(enabled: boolean) {
    setDataSaver(enabled);
    if (enabled) setFastResponse(false);
    setMessage("");
  }

  async function saveSection() {
    if (section === "generation") {
      localStorage.setItem(DEFAULT_CURRICULUM_KEY, curriculum);
      localStorage.setItem(DEFAULT_SCHOOL_LEVEL_KEY, schoolLevel);
      localStorage.setItem(DEFAULT_GRADE_KEY, String(grade));
      localStorage.setItem(DEFAULT_SUBJECT_KEY, subject.trim() || defaultAssignmentPreferences.subject);
      localStorage.setItem(DEFAULT_ASSIGNMENT_TYPE_KEY, assignmentType);
    } else if (section === "files") {
      localStorage.setItem(FILE_NAME_FORMAT_KEY, fileFormat);
      localStorage.setItem(FILE_NAME_SEPARATOR_KEY, fileSeparator);
      const prefix = filePrefix.trim();
      if (prefix) localStorage.setItem(FILE_NAME_PREFIX_KEY, prefix);
      else localStorage.removeItem(FILE_NAME_PREFIX_KEY);
      const example = fileExample.trim();
      if (example) localStorage.setItem(FILE_NAME_EXAMPLE_KEY, example);
      else localStorage.removeItem(FILE_NAME_EXAMPLE_KEY);
    } else if (section === "display") {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(FONT_SIZE_KEY, fontSize);
      applyVisualPreferences();
    } else if (section === "accessibility") {
      localStorage.setItem(HIGH_CONTRAST_KEY, highContrast ? "1" : "0");
      localStorage.setItem(LARGE_CONTROLS_KEY, largeControls ? "1" : "0");
      localStorage.setItem(REDUCE_MOTION_KEY, reduceMotion ? "1" : "0");
      applyVisualPreferences();
    } else if (section === "behavior") {
      localStorage.setItem(FAST_RESPONSE_KEY, fastResponse ? "1" : "0");
      localStorage.setItem(DATA_SAVER_KEY, dataSaver ? "1" : "0");
      localStorage.setItem(HAPTIC_KEY, haptics && supportsHaptics ? "1" : "0");
      localStorage.setItem(WAKE_KEY, keepAwake && supportsWakeLock ? "1" : "0");
      applyVisualPreferences();
      if (haptics && supportsHaptics) navigator.vibrate(10);
    } else if (section === "notifications") {
      if (notifications) {
        if (!supportsNotifications) {
          setMessage("이 브라우저에서는 알림을 지원하지 않습니다.");
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setNotifications(false);
          localStorage.setItem(NOTIFICATION_KEY, "0");
          setMessage("알림 권한이 허용되지 않아 저장하지 못했습니다.");
          return;
        }
      }
      localStorage.setItem(NOTIFICATION_KEY, notifications ? "1" : "0");
    } else if (section === "navigation") {
      localStorage.setItem(START_PAGE_KEY, startPage);
      sessionStorage.removeItem(START_SESSION_KEY);
    } else if (section === "storage") {
      localStorage.setItem(CACHE_CLEANUP_DAYS_KEY, cleanupDays);
      localStorage.setItem(CACHE_LIMIT_MB_KEY, cacheLimit);
    } else if (section === "misc" && resetRequested) {
      resetAllPreferences();
    }

    router.push("/settings");
  }

  function resetGenerationDefaults() {
    setCurriculum(defaultAssignmentPreferences.curriculum);
    setSchoolLevel(defaultAssignmentPreferences.schoolLevel);
    setGrade(defaultAssignmentPreferences.grade);
    setSubject(defaultAssignmentPreferences.subject);
    setAssignmentType(defaultAssignmentPreferences.assignmentType);
    setMessage("기본값으로 변경했습니다. 저장을 눌러야 적용됩니다.");
  }

  function resetFileSettings() {
    setFileFormat("title");
    setFilePrefix("");
    setFileSeparator("_");
    setFileExample("");
    setMessage("기본값으로 변경했습니다. 저장을 눌러야 적용됩니다.");
  }

  function resetAllPreferences() {
    SETTINGS_BACKUP_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(CACHE_LAST_CLEANUP_KEY);
    sessionStorage.removeItem(START_SESSION_KEY);
    const nextTheme: ThemePreference = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.dataset.fontSize = "default";
    document.documentElement.dataset.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "true" : "false";
    document.documentElement.dataset.highContrast = "false";
    document.documentElement.dataset.largeControls = "false";
    document.documentElement.dataset.fastResponse = "false";
    document.documentElement.dataset.dataSaver = "false";
    document.documentElement.style.colorScheme = nextTheme;
    window.dispatchEvent(new Event("assessment-theme-change"));
    preferenceChanged();
  }

  function exportPreferences() {
    const preferences: Record<string, string> = {};
    for (const key of SETTINGS_BACKUP_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) preferences[key] = value;
    }
    const payload = { app: "수행평가 도우미", version: 1, exportedAt: new Date().toISOString(), preferences };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `assessment-helper-settings-${localDateToken()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage("주요 앱 설정을 백업 파일로 내보냈습니다.");
  }

  async function importPreferences(file: File | undefined) {
    if (!file) return;
    if (file.size > 256 * 1024) {
      setMessage("설정 백업 파일이 너무 큽니다.");
      return;
    }

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid payload");
      const payload = parsed as { version?: unknown; preferences?: unknown };
      if (payload.version !== 1 || !payload.preferences || typeof payload.preferences !== "object" || Array.isArray(payload.preferences)) throw new Error("invalid schema");
      const preferences = payload.preferences as Record<string, unknown>;
      SETTINGS_BACKUP_KEYS.forEach((key) => localStorage.removeItem(key));
      for (const key of SETTINGS_BACKUP_KEYS) {
        const value = preferences[key];
        if (typeof value === "string") localStorage.setItem(key, value);
      }
      sessionStorage.removeItem(START_SESSION_KEY);
      sessionStorage.setItem(SETTINGS_IMPORT_NOTICE_KEY, "1");
      window.location.reload();
    } catch {
      setMessage("수행평가 도우미에서 만든 올바른 설정 백업 파일인지 확인해 주세요.");
    }
  }

  async function refreshStorage() {
    setStorageLoading(true);
    try {
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        setStorageUsage(estimate.usage ?? 0);
        setStorageQuota(estimate.quota ?? 0);
      } else {
        setStorageUsage(null);
        setStorageQuota(null);
      }
      if ("caches" in window) setCacheCount((await caches.keys()).length);
      else setCacheCount(null);
    } finally {
      setStorageLoading(false);
    }
  }

  async function clearCaches() {
    if (!("caches" in window)) {
      setMessage("이 브라우저에서는 캐시 삭제를 지원하지 않습니다.");
      return;
    }
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    localStorage.setItem(CACHE_LAST_CLEANUP_KEY, String(Date.now()));
    setMessage(`캐시 ${names.length}개를 정리했습니다. 필요한 파일은 다음 사용 때 다시 저장됩니다.`);
    await refreshStorage();
  }

  function clearCurrentWork() {
    currentSessionKeys.forEach((key) => sessionStorage.removeItem(key));
    setMessage("현재 브라우저 탭의 수행평가 작업 데이터를 지웠습니다.");
  }

  let content: ReactNode;

  if (section === "generation") {
    content = (
      <>
        <SettingsRow title="기본 교육과정" description="새 수행평가를 시작할 때 처음 선택되는 교육과정입니다." control={<select className={selectClass} value={curriculum} onChange={(event) => { setCurriculum(event.target.value as Curriculum); setMessage(""); }}><option>2022 개정 교육과정</option><option>2015 개정 교육과정</option></select>} />
        <SettingsRow title="기본 학교급" description="새 수행평가에서 기본으로 사용할 학교급입니다." control={<select className={selectClass} value={schoolLevel} onChange={(event) => { const value = event.target.value as SchoolLevel; setSchoolLevel(value); setGrade((current) => Math.min(current, value === "초등학교" ? 6 : 3)); setMessage(""); }}><option>초등학교</option><option>중학교</option><option>고등학교</option></select>} />
        <SettingsRow title="기본 학년" description="학교급에 맞는 학년을 기본값으로 저장합니다." control={<select className={selectClass} value={grade} onChange={(event) => { setGrade(Number(event.target.value)); setMessage(""); }}>{gradeOptions.map((value) => <option key={value} value={value}>{value}학년</option>)}</select>} />
        <SettingsRow title="기본 과목" description="새 수행평가 정보 입력 화면에 자동으로 채울 과목입니다." control={<input className={inputClass} maxLength={80} value={subject} onChange={(event) => { setSubject(event.target.value); setMessage(""); }} />} />
        <SettingsRow title="기본 수행평가 유형" description="유형을 따로 고르지 않았을 때 사용할 기본 방식입니다." control={<select className={selectClass} value={assignmentType} onChange={(event) => { setAssignmentType(event.target.value as AssignmentType); setMessage(""); }}>{assignmentTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.title}</option>)}</select>} />
      </>
    );
  } else if (section === "files") {
    const previewParts = [filePrefix.trim(), "통합사회_수행평가"];
    if (fileFormat === "title_date") previewParts.push(localDateToken());
    previewParts.push("결과");
    const preview = `${previewParts.filter(Boolean).join(fileSeparator)}.pdf`;
    content = (
      <>
        <SettingsRow title="파일명 형식" description="결과 파일 이름에 날짜를 붙일지 정합니다." control={<select className={selectClass} value={fileFormat} onChange={(event) => { setFileFormat(event.target.value as FileNameFormat); setMessage(""); }}><option value="title">제목 + 파일 종류</option><option value="title_date">제목 + 날짜 + 파일 종류</option></select>} />
        <SettingsRow title="파일명 앞글자" description="파일 이름 앞에 붙일 짧은 문구입니다. 비워두면 사용하지 않습니다." control={<input className={inputClass} maxLength={30} placeholder="예: 수행" value={filePrefix} onChange={(event) => { setFilePrefix(event.target.value.slice(0, 30)); setMessage(""); }} />} />
        <SettingsRow title="구분자" description="파일명 항목 사이를 밑줄, 하이픈 또는 띄어쓰기로 구분합니다." control={<div className="flex rounded-xl bg-slate-100 p-1">{(["_", "-", " "] as const).map((value) => <button aria-pressed={fileSeparator === value} className={`min-h-10 rounded-lg px-3 text-sm font-black ${fileSeparator === value ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`} key={value} onClick={() => { setFileSeparator(value); setMessage(""); }} type="button">{value === " " ? "띄어쓰기" : value}</button>)}</div>} />
        <div className="px-4 py-4 sm:px-5"><label className="font-extrabold text-slate-900" htmlFor="file-example">원하는 파일명 예시</label><p className="mt-1 text-sm leading-6 text-slate-500">참고용으로 원하는 이름 모양을 저장해 둘 수 있습니다.</p><input className={`${inputClass} mt-3 w-full`} id="file-example" maxLength={100} placeholder="예: 통합사회 수행평가 최종본.pdf" value={fileExample} onChange={(event) => { setFileExample(event.target.value.slice(0, 100)); setMessage(""); }} /><p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm font-black text-violet-700">현재 규칙 예시: {preview}</p></div>
      </>
    );
  } else if (section === "display") {
    content = (
      <>
        <SettingsRow title="화면 테마" description="라이트 또는 다크 화면을 선택합니다." control={<Segmented value={theme} items={[["light", "라이트"], ["dark", "다크"]]} onChange={(value) => { setTheme(value as ThemePreference); setMessage(""); }} />} />
        <SettingsRow title="글자 크기" description="앱 전체 글자 크기를 조절합니다." control={<Segmented value={fontSize} items={[["small", "작게"], ["default", "기본"], ["large", "크게"]]} onChange={(value) => { setFontSize(value as FontSizePreference); setMessage(""); }} />} />
      </>
    );
  } else if (section === "accessibility") {
    content = (
      <>
        <SettingsRow title="고대비 모드" description="텍스트와 주요 경계선을 더 선명하게 표시합니다." control={<PreferenceToggle enabled={highContrast} onChange={(value) => { setHighContrast(value); setMessage(""); }} label="고대비 모드" />} />
        <SettingsRow title="큰 조작 버튼" description="버튼과 선택 상자의 최소 높이를 키웁니다." control={<PreferenceToggle enabled={largeControls} onChange={(value) => { setLargeControls(value); setMessage(""); }} label="큰 조작 버튼" />} />
        <SettingsRow title="애니메이션 줄이기" description="전환 효과와 움직임을 최소화합니다." control={<PreferenceToggle enabled={reduceMotion} onChange={(value) => { setReduceMotion(value); setMessage(""); }} label="애니메이션 줄이기" />} />
      </>
    );
  } else if (section === "behavior") {
    content = (
      <>
        <SettingsRow title="빠른 반응 모드" description="버튼과 화면 전환 시간을 더 짧게 적용합니다." control={<PreferenceToggle enabled={fastResponse} onChange={stageFastResponse} label="빠른 반응 모드" />} />
        <SettingsRow title="버튼 진동" description={supportsHaptics ? "버튼을 누를 때 짧게 진동합니다." : "이 기기에서는 지원하지 않습니다."} disabled={!supportsHaptics} control={<PreferenceToggle enabled={haptics} disabled={!supportsHaptics} onChange={(value) => { setHaptics(value); setMessage(""); }} label="버튼 진동" />} />
        <SettingsRow title="데이터 절약 모드" description="배경 효과와 불필요한 화면 효과를 줄입니다. 빠른 반응 모드와 동시에 사용하지 않습니다." control={<PreferenceToggle enabled={dataSaver} onChange={stageDataSaver} label="데이터 절약 모드" />} />
        <SettingsRow title="화면 계속 켜기" description={supportsWakeLock ? "앱을 사용하는 동안 화면 자동 꺼짐을 방지합니다." : "이 브라우저에서는 지원하지 않습니다."} disabled={!supportsWakeLock} control={<PreferenceToggle enabled={keepAwake} disabled={!supportsWakeLock} onChange={(value) => { setKeepAwake(value); setMessage(""); }} label="화면 계속 켜기" />} />
      </>
    );
  } else if (section === "notifications") {
    content = <SettingsRow title="앱 알림" description={supportsNotifications ? "알림 사용 여부를 선택합니다. 실제 브라우저 권한은 저장할 때 요청합니다." : "이 브라우저에서는 알림을 지원하지 않습니다."} disabled={!supportsNotifications} control={<PreferenceToggle enabled={notifications} disabled={!supportsNotifications} onChange={(value) => { setNotifications(value); setMessage(""); }} label="앱 알림" />} />;
  } else if (section === "navigation") {
    content = <SettingsRow title="시작 화면" description="앱을 새로 열었을 때 처음 이동할 수행평가 화면을 선택합니다." control={<select className={selectClass} value={startPage} onChange={(event) => { setStartPage(event.target.value as StartPagePreference); setMessage(""); }}><option value="home">홈</option><option value="auto">자동 분석 시작</option><option value="report">탐구·보고서 시작</option><option value="presentation">발표·토론 시작</option><option value="experiment">실험·탐구 시작</option></select>} />;
  } else if (section === "storage") {
    content = (
      <>
        <SettingsRow title="오래된 캐시 자동 삭제" description="선택한 기간마다 앱 캐시를 자동 정리합니다." control={<select className={selectClass} value={cleanupDays} onChange={(event) => { setCleanupDays(event.target.value as CacheCleanupDays); setMessage(""); }}><option value="off">사용 안 함</option><option value="7">7일</option><option value="30">30일</option><option value="90">90일</option></select>} />
        <SettingsRow title="캐시 최대 용량" description="브라우저 사용량이 이 기준을 넘으면 앱 캐시를 정리합니다." control={<select className={selectClass} value={cacheLimit} onChange={(event) => { setCacheLimit(event.target.value as CacheLimitMb); setMessage(""); }}><option value="off">제한 없음</option><option value="50">50 MB</option><option value="100">100 MB</option><option value="250">250 MB</option></select>} />
        <SettingsRow title="현재 브라우저 저장공간" description={storageUsage === null ? "브라우저가 저장공간 정보를 제공하지 않을 수 있습니다." : `${formatBytes(storageUsage)} 사용${storageQuota ? ` / ${formatBytes(storageQuota)} 허용` : ""}`} control={<button className={outlineButtonClass} disabled={storageLoading} onClick={() => void refreshStorage()} type="button">{storageLoading ? "확인 중" : "새로고침"}</button>} />
        <SettingsRow title="앱 캐시" description={cacheCount === null ? "캐시 목록 확인을 지원하지 않습니다." : `${cacheCount}개 캐시가 저장되어 있습니다.`} control={<button className={dangerButtonClass} onClick={() => void clearCaches()} type="button">캐시 삭제</button>} />
        <SettingsRow title="현재 작업 데이터" description="이 브라우저 탭에 임시 저장된 수행평가 정보·분석·초안·검증 결과를 지웁니다." control={<button className={dangerButtonClass} onClick={clearCurrentWork} type="button">작업 지우기</button>} />
      </>
    );
  } else if (section === "backup") {
    content = (
      <>
        <SettingsRow title="설정 내보내기" description="화면·접근성·성능·알림·수행평가 기본값·파일·저장공간 설정을 JSON 파일로 저장합니다." control={<button className={outlineButtonClass} onClick={exportPreferences} type="button">내보내기</button>} />
        <SettingsRow title="설정 불러오기" description="수행평가 도우미에서 내보낸 설정 파일을 불러옵니다. 현재 수행평가 작업 내용은 변경하지 않습니다." control={<label className={`${outlineButtonClass} cursor-pointer`}>불러오기<input accept="application/json,.json" className="sr-only" type="file" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void importPreferences(file); }} /></label>} />
        <SettingsRow title="백업 범위" description="API 키, 업로드 파일, 생성된 초안과 검증 결과는 백업 파일에 포함하지 않습니다." control={<span className="text-sm font-extrabold text-slate-500">설정만</span>} />
      </>
    );
  } else if (section === "about") {
    content = (
      <>
        <SettingsRow title="앱 이름" description="수행평가 준비와 검증을 돕는 웹앱입니다." control={<span className="text-sm font-black text-slate-700">수행평가 도우미</span>} />
        <SettingsRow title="현재 버전" description="현재 배포된 앱 패키지 버전입니다." control={<span className="text-sm font-black text-slate-700">v{appVersion}</span>} />
        <SettingsRow title="앱 형태" description="브라우저에서 사용하고 홈 화면에 설치할 수 있습니다." control={<span className="text-sm font-black text-slate-700">PWA</span>} />
        <SettingsRow title="기기 설정 저장" description="개인 설정은 현재 브라우저의 기기 저장공간에 저장됩니다." control={<span className="text-sm font-black text-slate-500">이 기기</span>} />
        <div className="px-4 py-4 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-extrabold text-slate-900">앱으로 설치</h2><p className="mt-1 text-sm leading-6 text-slate-500">지원되는 브라우저에서 홈 화면 앱으로 설치합니다.</p></div><InstallAppButton /></div></div>
      </>
    );
  } else if (section === "connections") {
    content = (
      <>
        {connections.map((connection) => <SettingsRow key={connection.name} title={connection.name} description={connection.description} control={<span className={`rounded-full px-3 py-1 text-xs font-extrabold ${connection.connected ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{connection.connected ? "연결됨" : "설정 필요"}</span>} />)}
        <SettingsRow title="입력·생성 결과 서버 보관" description="현재 앱은 수행평가 입력과 생성 결과를 자체 DB에 저장하지 않습니다." control={<span className="text-sm font-extrabold text-slate-500">저장 안 함</span>} />
        <SettingsRow title="평가표 PDF" description="업로드 가능한 PDF 파일 크기 기준입니다." control={<span className="text-sm font-extrabold text-slate-500">최대 4MB</span>} />
        <SettingsRow title="PDF 판독 범위" description="AI가 판독하는 평가표 PDF 페이지 범위입니다." control={<span className="text-sm font-extrabold text-slate-500">최대 6페이지</span>} />
      </>
    );
  } else {
    content = <SettingsRow title="앱 설정 초기화" description={resetRequested ? "저장을 누르면 수행평가 도우미의 기기 설정을 기본값으로 초기화합니다." : "초기화를 선택한 뒤 저장을 눌러야 실제로 적용됩니다."} control={<button aria-pressed={resetRequested} className={resetRequested ? `${dangerButtonClass} bg-red-50` : dangerButtonClass} onClick={() => { setResetRequested((value) => !value); setMessage(""); }} type="button">{resetRequested ? "초기화 선택됨" : "초기화"}</button>} />;
  }

  const showSave = ["generation", "files", "display", "accessibility", "behavior", "notifications", "navigation", "storage", "misc"].includes(section);

  return (
    <div className="space-y-4">
      <div className="divide-y divide-slate-100 overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white/90 shadow-sm">{content}</div>

      {section === "generation" ? <button className={secondaryWideButtonClass} onClick={resetGenerationDefaults} type="button">수행평가 기본값 초기화</button> : null}
      {section === "files" ? <button className={secondaryWideButtonClass} onClick={resetFileSettings} type="button">PDF·파일 설정 초기화</button> : null}
      {showSave ? <button className={primaryWideButtonClass} onClick={() => void saveSection()} type="button">저장</button> : null}
      {message ? <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold leading-6 text-violet-700" role="status">{message}</div> : null}
    </div>
  );
}

function SettingsRow({ title, description, control, disabled = false }: { title: string; description: string; control: ReactNode; disabled?: boolean }) {
  return <div className={`flex min-h-24 items-center justify-between gap-4 px-4 py-4 sm:px-5 ${disabled ? "opacity-50" : ""}`}><div className="min-w-0 flex-1"><h2 className="font-extrabold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div><div className="shrink-0">{control}</div></div>;
}

function PreferenceToggle({ enabled, onChange, label, disabled = false }: { enabled: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <button aria-label={label} aria-pressed={enabled} className={`relative h-8 w-14 rounded-full transition ${enabled ? "bg-violet-600" : "bg-slate-200"}`} disabled={disabled} onClick={() => onChange(!enabled)} type="button"><span className={`absolute top-1 size-6 rounded-full bg-white shadow-sm transition ${enabled ? "left-7" : "left-1"}`} /></button>;
}

function Segmented({ value, items, onChange }: { value: string; items: readonly (readonly [string, string])[]; onChange: (value: string) => void }) {
  return <div className="flex rounded-xl bg-slate-100 p-1">{items.map(([itemValue, label]) => <button aria-pressed={value === itemValue} className={`min-h-10 rounded-lg px-3 text-sm font-extrabold ${value === itemValue ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`} key={itemValue} onClick={() => onChange(itemValue)} type="button">{label}</button>)}</div>;
}

function localDateToken() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

const selectClass = "min-h-11 max-w-56 rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold";
const inputClass = "min-h-11 w-40 rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold";
const outlineButtonClass = "inline-flex min-h-10 items-center justify-center rounded-xl border border-violet-200 px-3 text-sm font-extrabold text-violet-700 disabled:opacity-50";
const dangerButtonClass = "inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 px-3 text-sm font-extrabold text-red-700";
const primaryWideButtonClass = "min-h-13 w-full rounded-2xl bg-violet-600 px-5 py-3.5 font-black text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.99]";
const secondaryWideButtonClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-white font-extrabold text-slate-600 transition active:scale-[0.99]";
