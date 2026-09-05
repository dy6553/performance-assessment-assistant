import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_COOKIE } from "@/lib/supabase/auth-cookies";

type SyncBody = { action?: string; deviceId?: string; [key: string]: unknown };

function config() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.sb_public_key;
  if (!url || !key) throw new Error("SUPABASE_SYNC_CONFIGURATION");
  return { url, key };
}

async function rpc<T>(name: string, body: unknown, token: string): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message || `SYNC_RPC_${response.status}`);
  }
  return response.status === 204 ? ({} as T) : ((await response.json()) as T);
}

export async function POST(request: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  let body: SyncBody;
  try { body = (await request.json()) as SyncBody; }
  catch { return NextResponse.json({ error: "잘못된 동기화 요청입니다." }, { status: 400 }); }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  if (!deviceId) return NextResponse.json({ error: "기기 식별자가 없습니다." }, { status: 400 });

  try {
    let result: unknown;
    switch (body.action) {
      case "register":
        result = await rpc("sync_register_device", {
          p_device_id: deviceId,
          p_device_name: body.deviceName,
          p_platform: body.platform,
          p_public_key: body.publicKey,
        }, token);
        break;
      case "devices": result = await rpc("sync_list_devices", { p_device_id: deviceId }, token); break;
      case "key-envelope": result = await rpc("sync_get_key_envelope", { p_device_id: deviceId }, token); break;
      case "put-key-envelope":
        result = await rpc("sync_put_key_envelope", {
          p_device_id: deviceId,
          p_target_device_id: body.targetDeviceId || deviceId,
          p_wrapped_key: body.wrappedKey,
        }, token);
        break;
      case "push": result = await rpc("sync_push_records", { p_device_id: deviceId, p_records: body.records }, token); break;
      case "pull": result = await rpc("sync_pull_records", { p_device_id: deviceId, p_cursor: body.cursor }, token); break;
      case "touch": result = await rpc("sync_touch_device", { p_device_id: deviceId, p_last_sync_at: body.lastSyncAt }, token); break;
      case "revoke": result = await rpc("sync_revoke_device", { p_device_id: deviceId, p_target_device_id: body.targetDeviceId }, token); break;
      default: return NextResponse.json({ error: "지원하지 않는 동기화 작업입니다." }, { status: 400 });
    }
    const normalized = Array.isArray(result) && result.length === 1 ? result[0] : result;
    return NextResponse.json(normalized, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "동기화 서버에 연결하지 못했습니다." },
      { status: 502 },
    );
  }
}
