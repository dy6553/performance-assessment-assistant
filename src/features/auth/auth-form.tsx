"use client";

import { useActionState } from "react";

import { loginAction, signupAction } from "@/app/login/actions";
import type { AuthFormState } from "./schemas";

const initialState: AuthFormState = { message: "" };

export function AuthForm({ nextPath = "/account" }: { nextPath?: string }) {
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, initialState);
  const [signupState, signupFormAction, signupPending] = useActionState(signupAction, initialState);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <AuthPanel
        action={loginFormAction}
        message={loginState.message}
        nextPath={nextPath}
        pending={loginPending}
        submitLabel="로그인"
        title="기존 계정으로 로그인"
      />
      <AuthPanel
        action={signupFormAction}
        message={signupState.message}
        nextPath={nextPath}
        nickname
        pending={signupPending}
        submitLabel="회원가입"
        success={signupState.success}
        title="새 계정 만들기"
      />
    </div>
  );
}

function AuthPanel({
  action,
  title,
  submitLabel,
  pending,
  message,
  nextPath,
  nickname = false,
  success = false,
}: {
  action: (payload: FormData) => void;
  title: string;
  submitLabel: string;
  pending: boolean;
  message: string;
  nextPath: string;
  nickname?: boolean;
  success?: boolean;
}) {
  return (
    <form action={action} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <input name="next" type="hidden" value={nextPath} />
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
        {nickname
          ? "닉네임과 이메일, 비밀번호로 수행평가 도우미 계정을 만듭니다."
          : "가입한 이메일과 비밀번호를 입력해 주세요."}
      </p>

      <div className="mt-5 space-y-4">
        {nickname ? (
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">닉네임</span>
            <input
              autoComplete="nickname"
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-950 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              maxLength={30}
              name="nickname"
              placeholder="사용할 닉네임"
              required
            />
          </label>
        ) : null}

        <label className="block">
          <span className="mb-2 block text-sm font-black text-slate-700">이메일</span>
          <input
            autoComplete="email"
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-950 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            name="email"
            placeholder="name@example.com"
            required
            type="email"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-black text-slate-700">비밀번호</span>
          <input
            autoComplete={nickname ? "new-password" : "current-password"}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-950 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            minLength={8}
            name="password"
            placeholder="8자 이상"
            required
            type="password"
          />
        </label>
      </div>

      <p
        aria-live="polite"
        className={`mt-4 min-h-6 text-sm font-bold ${success ? "text-emerald-700" : "text-rose-700"}`}
      >
        {message}
      </p>

      <button
        className="mt-3 min-h-12 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 font-black text-white shadow-md shadow-violet-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "처리 중…" : submitLabel}
      </button>
    </form>
  );
}
