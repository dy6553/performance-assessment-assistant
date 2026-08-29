import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "./icons";

export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
}) {
  return (
    <header className="mb-6 flex items-start gap-3 sm:mb-8">
      {backHref ? (
        <Link
          aria-label="이전 화면"
          className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl border border-violet-100 bg-white/90 text-slate-600 shadow-sm transition hover:text-violet-700"
          href={backHref}
        >
          <Icon className="size-5" name="chevron-left" />
        </Link>
      ) : null}
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm font-extrabold text-violet-700">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-black tracking-[-0.025em] text-slate-950 sm:text-3xl">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-2xl leading-7 text-slate-600">{description}</p> : null}
      </div>
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-white/90 bg-white/90 p-5 shadow-lg shadow-violet-100/40 backdrop-blur-sm sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function StatusCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800" role="status">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80">
        <Icon className="size-5" name="check" />
      </span>
      <div>
        <p className="font-extrabold">{title}</p>
        <p className="mt-1 text-sm leading-6 opacity-85">{description}</p>
      </div>
    </div>
  );
}
