import { NextResponse } from "next/server";

import { establishSessionFromConfirmation } from "@/lib/supabase/server/auth";

type ConfirmationSessionBody = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
};

export async function POST(request: Request) {
  let body: ConfirmationSessionBody;
  try {
    body = (await request.json()) as ConfirmationSessionBody;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const accessToken = body.accessToken?.trim();
  const refreshToken = body.refreshToken?.trim();
  const expiresIn = Number(body.expiresIn ?? 3600);

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "인증 정보가 없습니다." }, { status: 400 });
  }

  const ok = await establishSessionFromConfirmation(accessToken, refreshToken, expiresIn);
  if (!ok) {
    return NextResponse.json({ error: "이메일 인증 세션을 확인하지 못했습니다." }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "private, no-store" } },
  );
}
