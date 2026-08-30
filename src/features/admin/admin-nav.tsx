import Link from "next/link";

const links = [
  ["대시보드", "/admin"],
  ["사용자", "/admin/users"],
  ["AI 모델", "/admin/ai-models"],
  ["AI·인프라", "/admin/services"],
  ["감사 로그", "/admin/audit-logs"],
  ["설정", "/admin/settings"],
] as const;

export function AdminNav() {
  return (
    <nav aria-label="관리자 메뉴" className="mb-6 flex gap-2 overflow-x-auto pb-1">
      {links.map(([label, href]) => (
        <Link
          className="min-h-11 shrink-0 rounded-2xl border border-violet-100 bg-white/80 px-4 py-2.5 text-sm font-extrabold text-violet-700 shadow-sm transition active:scale-[0.97]"
          href={href}
          key={href}
          prefetch
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
