"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const navigation: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/settings", label: "설정", icon: "settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh text-slate-950">
      <header className="sticky top-0 z-40 border-b border-violet-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link className="inline-flex items-center gap-2 font-black" href="/">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-sky-500 text-sm text-white shadow-md">수행</span>
            <span className="text-lg">수행평가 도우미</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Link aria-label="설정" className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600" href="/settings">
              <Icon name="settings" />
            </Link>
          </div>
        </div>
      </header>

      <div className="pb-24 md:pb-8">{children}</div>

      <nav aria-label="모바일 메뉴" className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-100 bg-white/95 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-xs grid-cols-2">
          {navigation.map((item) => {
            const active = item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-black ${active ? "text-violet-700" : "text-slate-400"}`} href={item.href} key={item.href}>
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
