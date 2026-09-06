"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DATA_SAVER_KEY = "assessment-data-saver";
const ROUTES = [
  "/",
  "/ai-tools",
  "/create",
  "/calendar",
  "/assignment/history",
  "/settings",
  "/account",
  "/topic-recommender",
  "/assignment/setup",
  "/assignment/topic",
  "/assignment/inquiry",
  "/assignment/review",
  "/assignment/workspace",
  "/assignment/draft",
  "/assignment/verification",
  "/assignment/final"
] as const;

export function RoutePreloadRuntime() {
  const router = useRouter();

  useEffect(() => {
    const timers: number[] = [];
    const warmed = new Set<string>();

    const warm = (route: string) => {
      if (warmed.has(route) || !navigator.onLine || localStorage.getItem(DATA_SAVER_KEY) === "1") return;
      warmed.add(route);
      router.prefetch(route);
    };

    const warmAll = () => {
      ROUTES.forEach((route, index) => {
        timers.push(window.setTimeout(() => warm(route), 350 + index * 140));
      });
    };

    const warmLinkedRoute = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const href = target?.getAttribute("href");
      if (href?.startsWith("/") && !href.startsWith("//")) warm(href.split("?")[0]);
    };

    warmAll();
    window.addEventListener("online", warmAll);
    document.addEventListener("pointerover", warmLinkedRoute, { passive: true });
    document.addEventListener("focusin", warmLinkedRoute);

    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("online", warmAll);
      document.removeEventListener("pointerover", warmLinkedRoute);
      document.removeEventListener("focusin", warmLinkedRoute);
    };
  }, [router]);

  return null;
}
