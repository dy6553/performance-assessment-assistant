import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "수행평가 도우미",
    short_name: "수행도우미",
    description: "수행평가 요구조건 분석부터 전략, 초안, 검증까지 돕는 AI 앱",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#7c3aed",
    lang: "ko-KR",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
