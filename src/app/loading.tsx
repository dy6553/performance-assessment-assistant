export default function AppLoading() {
  return (
    <main className="mx-auto min-h-[60dvh] max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="animate-pulse space-y-5" aria-label="화면을 빠르게 준비하는 중" role="status">
        <div className="h-4 w-24 rounded-full bg-violet-100" />
        <div className="h-9 w-2/3 rounded-2xl bg-slate-200" />
        <div className="h-4 w-full max-w-xl rounded-full bg-slate-100" />
        <div className="grid gap-4 pt-3 sm:grid-cols-2">
          <div className="h-36 rounded-3xl bg-slate-100" />
          <div className="h-36 rounded-3xl bg-slate-100" />
        </div>
      </div>
    </main>
  );
}
