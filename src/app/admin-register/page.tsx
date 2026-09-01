"use client";

import Link from "next/link";
import { useActionState } from "react";

import { adminRegisterAction, type AdminRegisterState } from "./actions";

const initialState: AdminRegisterState = { message: "" };

export default function AdminRegisterPage() {
  const [state, action, pending] = useActionState(adminRegisterAction, initialState);

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-xl px-4 py-10 sm:px-6">
      <Link className="text-sm font-black text-violet-700" href="/login">← 로그인으로</Link>
      <div className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-black text-violet-700">최고 관리자 전용</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">관리자 계정 만들기</h1>
        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">서버에 등록된 최고 관리자 이메일만 가입할 수 있습니다.</p>
        <form action={action} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">관리자 이메일</span>
            <input autoComplete="email" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold" name="email" required type="email" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">비밀번호</span>
            <input autoComplete="new-password" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold" minLength={8} name="password" placeholder="8자 이상" required type="password" />
          </label>
          <p aria-live="polite" className={`min-h-6 text-sm font-bold ${state.success ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
          <button className="min-h-12 w-full rounded-2xl bg-violet-600 px-5 font-black text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "처리 중…" : "관리자 계정 만들기"}</button>
        </form>
      </div>
    </main>
  );
}
