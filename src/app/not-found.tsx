import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl items-center px-4 py-12">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-black text-violet-700">404</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">페이지를 찾을 수 없습니다</h1>
        <Link className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-slate-950 px-5 font-black text-white" href="/">홈으로</Link>
      </section>
    </main>
  );
}
