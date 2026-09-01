"use client";

import Link from "next/link";
import { useActionState } from "react";

import { developerLoginAction, type DeveloperLoginState } from "./actions";

const initialState: DeveloperLoginState = { message: "" };

export default function DeveloperLoginPage() {
  const [state, action, pending] = useActionState(developerLoginAction, initialState);

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-xl px-4 py-10 sm:px-6">
      <Link className="text-sm font-black text-violet-700" href="/login">← 일반 로그인</Link>
      <div className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-black text-violet-700">GPT 테스트 전용</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">개발자 ID 로그인</h1>
        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">이메일은 필요하지 않습니다. 관리자가 생성하고 승인한 개발자 테스트 ID만 로그인할 수 있습니다.</p>

        <form action={action} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">개발자 ID</span>
            <input autoComplete="username" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold" name="developerId" pattern="[A-Za-z0-9_-]{3,32}" placeholder="gpt-test-01" required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">비밀번호</span>
            <input autoComplete="current-password" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold" minLength={8} name="password" placeholder="8자 이상" required type="password" />
          </label>
          <p aria-live="polite" className="min-h-6 text-sm font-bold text-rose-700">{state.message}</p>
          <button className="min-h-12 w-full rounded-2xl bg-violet-600 px-5 font-black text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "확인 중…" : "개발자 로그인"}</button>
        </form>
      </div>
    </main>
  );
}
