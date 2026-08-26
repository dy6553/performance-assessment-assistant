import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "수행평가 도우미",
    short_name: "수행도우미",
    description: "수행평가 요구조건을 분석하고 전략, 초안, 검증까지 한 번에 준비하는 AI 앱",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#7c3aed",
    lang: "ko",
    prefer_related_applications: false,
    // Samsung Internet's published install indication criteria require at
    // least one >=144px icon. Keep the install manifest conservative and PNG-only
    // so both Samsung Internet and Chromium can consume it consistently.
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
