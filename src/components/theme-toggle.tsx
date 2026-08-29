"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const THEME_EVENT = "assessment-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light");
  const nextTheme = theme === "dark" ? "light" : "dark";

  function changeTheme() {
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem("assessment-theme", nextTheme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", nextTheme === "dark" ? "#111827" : "#f8fafc");
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <button
      aria-label={`${nextTheme === "dark" ? "다크" : "라이트"} 모드로 전환`}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-violet-200 bg-white px-3 text-xs font-black text-violet-700 shadow-sm"
      onClick={changeTheme}
      type="button"
    >
      <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
      {compact ? null : <span>{theme === "dark" ? "라이트" : "다크"}</span>}
    </button>
  );
}
