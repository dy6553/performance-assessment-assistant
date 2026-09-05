"use client";

import { useEffect, useState } from "react";

import { listDevices, revokeDevice, syncNow } from "@/lib/sync/client";
import { idbGet } from "@/lib/local-data/db";
import type { DeviceInfo } from "@/lib/sync/types";

export function DeviceSyncSettings() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [error, setError] = useState("");
  async function refresh() {
    try {
      const local = await idbGet<{ deviceId: string }>("syncCrypto", "device");
      setCurrentId(local?.deviceId || "");
      setDevices((await listDevices()).devices);
      setError("");
    } catch { setError("기기 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); }
  }
  useEffect(() => { void refresh(); }, []);
  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-slate-950">암호화 자동 동기화</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">본문은 이 기기에서 AES-256-GCM으로 암호화된 뒤 전송됩니다.</p>
          </div>
          <button className="min-h-12 rounded-xl bg-violet-700 px-4 text-sm font-black text-white" onClick={() => void syncNow()} type="button">지금 동기화</button>
        </div>
      </div>
      {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}
      {devices.map((device) => (
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={device.deviceId}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-black text-slate-950">{device.deviceName} {device.deviceId === currentId ? <span className="text-violet-700">· 현재 기기</span> : null}</h3>
              <p className="mt-1 text-sm text-slate-500">{device.platform} · 마지막 접속 {new Date(device.lastSeenAt).toLocaleString("ko-KR")}</p>
              <p className="mt-1 text-sm text-slate-500">마지막 동기화 {device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString("ko-KR") : "아직 없음"}</p>
              {device.revokedAt ? <p className="mt-2 text-sm font-black text-rose-700">연결 해제됨</p> : null}
            </div>
            {device.deviceId !== currentId && !device.revokedAt ? (
              <button
                className="min-h-12 shrink-0 rounded-xl border border-rose-200 px-3 text-sm font-black text-rose-700"
                onClick={async () => {
                  if (!window.confirm(`${device.deviceName} 기기의 동기화 연결을 해제할까요?`)) return;
                  setDevices((await revokeDevice(device.deviceId)).devices);
                }}
                type="button"
              >연결 해제</button>
            ) : null}
          </div>
        </article>
      ))}
      <button className="min-h-12 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700" onClick={() => void refresh()} type="button">목록 새로고침</button>
    </section>
  );
}
