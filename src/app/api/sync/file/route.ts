import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_COOKIE } from "@/lib/supabase/auth-cookies";

function config() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.sb_public_key;
  if (!url || !key) throw new Error("SUPABASE_SYNC_CONFIGURATION");
  return { url, key };
}

async function assertDevice(url: string, key: string, token: string, deviceId: string) {
  const response = await fetch(`${url}/rest/v1/rpc/sync_assert_active_device`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_device_id: deviceId }), cache: "no-store",
  });
  if (!response.ok) throw new Error("DEVICE_REVOKED_OR_UNKNOWN");
}

export async function PUT(request: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const deviceId = request.headers.get("x-sync-device-id") || "";
  const storagePath = request.headers.get("x-sync-storage-path") || "";
  if (!deviceId || !storagePath || storagePath.includes("..")) return NextResponse.json({ error: "잘못된 파일 경로입니다." }, { status: 400 });
  try {
    const { url, key } = config();
    await assertDevice(url, key, token, deviceId);
    const response = await fetch(`${url}/storage/v1/object/encrypted-sync-files/${storagePath}`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream", "x-upsert": "true" },
      body: await request.arrayBuffer(), cache: "no-store",
    });
    if (!response.ok) throw new Error(`STORAGE_UPLOAD_${response.status}`);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "파일 업로드 실패" }, { status: 502 }); }
}

export async function GET(request: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("deviceId") || "";
  const storagePath = searchParams.get("storagePath") || "";
  if (!deviceId || !storagePath || storagePath.includes("..")) return NextResponse.json({ error: "잘못된 파일 경로입니다." }, { status: 400 });
  try {
    const { url, key } = config();
    await assertDevice(url, key, token, deviceId);
    const response = await fetch(`${url}/storage/v1/object/authenticated/encrypted-sync-files/${storagePath}`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error(`STORAGE_DOWNLOAD_${response.status}`);
    return new NextResponse(response.body, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "파일 다운로드 실패" }, { status: 502 }); }
}
