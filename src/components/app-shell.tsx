"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./icons";
import { ThemeToggle } from "./theme-toggle";

type NavigationItem = {
  href: string;
  label: string;
  icon: IconName;
  activePrefixes?: string[];
};

const navigation: NavigationItem[] = [
  { href: "/", label: "홈", icon: "home" },
  {
    href: "/ai-tools",
    label: "AI",
    icon: "sparkles",
    activePrefixes: ["/ai-tools", "/topic-recommender", "/assignment/setup/auto", "/grader"],
  },
  {
    href: "/assignment/report",
    label: "보고서",
    icon: "document",
    activePrefixes: ["/assignment/report", "/assignment/setup/research-report", "/assignment/setup/inquiry-report"],
  },
  { href: "/assignment/setup/presentation", label: "발표", icon: "presentation" },
  { href: "/assignment/setup/experiment", label: "탐구", icon: "flask" },
  { href: "/settings", label: "설정", icon: "settings" },
];

function isActive(pathname: string, item: NavigationItem) {
  if (item.href === "/") return pathname === "/";
  if (item.activePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  const pathname = usePathname();
  const historyActive = pathname === "/history" || pathname.startsWith("/history/");

  return (
    <div className="min-h-dvh text-slate-950">
      <header className="sticky top-0 z-40 border-b border-violet-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="inline-flex min-w-0 items-center gap-2 font-black" href="/">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-sky-500 text-sm text-white shadow-md">수행</span>
            <span className="truncate text-lg">수행평가 도우미</span>
          </Link>

          <nav aria-label="주요 메뉴" className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-2xl px-3.5 text-sm font-black transition active:scale-[0.97] ${
                    active
                      ? "bg-violet-100 text-violet-800"
                      : "text-slate-500 hover:bg-violet-50 hover:text-violet-800"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="size-4.5" name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-2 flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              aria-current={historyActive ? "page" : undefined}
              aria-label="최근 작업 기록"
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black transition active:scale-[0.97] ${
                historyActive
                  ? "bg-violet-100 text-violet-800"
                  : "bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-800"
              }`}
              href="/history"
              title="최근 작업 기록"
            >
              <Icon className="size-4" name="history" />
              <span className="hidden sm:inline">기록</span>
            </Link>
            <ThemeToggle compact />
            <Link
              className="inline-flex min-h-10 items-center rounded-full bg-gradient-to-r from-violet-50 to-fuchsia-50 px-3 py-2 text-xs font-black text-violet-800 transition active:scale-[0.97]"
              href={signedIn ? "/account" : "/login"}
            >
              {signedIn ? "내 계정" : "로그인"}
            </Link>
          </div>
        </div>
      </header>

      <div className="pb-24 md:pb-8">{children}</div>

      <nav
        aria-label="모바일 주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-100 bg-white/95 px-[max(.35rem,env(safe-area-inset-left))] pb-[max(.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {navigation.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[0.68rem] font-black transition active:scale-[0.97] ${
                  active ? "text-violet-700" : "text-slate-400"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon className="size-5" name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
