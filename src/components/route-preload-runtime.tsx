"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DATA_SAVER_KEY = "assessment-data-saver";
const PRIMARY_ROUTES = [
  "/",
  "/ai-tools",
  "/create",
  "/calendar",
  "/assignment/history",
  "/settings",
  "/account",
] as const;

export function RoutePreloadRuntime() {
  const router = useRouter();

  useEffect(() => {
    const timers: number[] = [];
    const warmed = new Set<string>();

    const canWarm = () => navigator.onLine && localStorage.getItem(DATA_SAVER_KEY) !== "1";
    const warm = (route: string) => {
      if (warmed.has(route) || !canWarm()) return;
      warmed.add(route);
      router.prefetch(route);
    };

    const warmPrimaryRoutes = () => {
      if (!canWarm()) return;
      PRIMARY_ROUTES.forEach((route, index) => {
        timers.push(window.setTimeout(() => warm(route), 450 + index * 420));
      });
    };

    const beginAfterFirstPaint = () => {
      timers.push(window.setTimeout(warmPrimaryRoutes, 1_500));
    };

    const warmLinkedRoute = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const href = target?.getAttribute("href");
      if (href?.startsWith("/") && !href.startsWith("//")) warm(href.split("?")[0]);
    };

    if (document.readyState === "complete") beginAfterFirstPaint();
    else window.addEventListener("load", beginAfterFirstPaint, { once: true });
    window.addEventListener("online", beginAfterFirstPaint);
    document.addEventListener("pointerover", warmLinkedRoute, { passive: true });
    document.addEventListener("focusin", warmLinkedRoute);

    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("load", beginAfterFirstPaint);
      window.removeEventListener("online", beginAfterFirstPaint);
      document.removeEventListener("pointerover", warmLinkedRoute);
      document.removeEventListener("focusin", warmLinkedRoute);
    };
  }, [router]);

  return null;
}
