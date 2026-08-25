import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wanhee 수행평가 도우미",
  description: "교사 요구조건·교육과정·루브릭을 먼저 분석하고 초안과 검증 근거를 함께 제공하는 수행평가 AI",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
