"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const HISTORY_CACHE_NAME = "performance-helper-history-v1";
const HISTORY_PREFIX = "/__wanhee_assignment_history__/";
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

type AssignmentSnapshot = {
  subject?: string;
  topic?: string;
  assignmentType?: string;
  schoolLevel?: string;
  grade?: number;
};

type HistoryRecord = {
  version: number;
  fingerprint: string;
  operation: "analyze" | "generate" | "verify";
  label: string;
  state: "RUNNING" | "DONE" | "ERROR";
  assignment: AssignmentSnapshot;
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
  httpStatus: number | null;
  startedAt: number;
  finishedAt: number | null;
  expiresAt: number;
  error: string | null;
};

type HistoryGroup = {
  fingerprint: string;
  assignment: AssignmentSnapshot;
  records: HistoryRecord[];
  latestAt: number;
  expiresAt: number;
};

export function AssignmentHistory() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheSupported, setCacheSupported] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!("caches" in window)) {
        if (!cancelled) {
          setCacheSupported(false);
          setLoading(false);
        }
        return;
      }

      try {
        const cache = await caches.open(HISTORY_CACHE_NAME);
        const keys = await cache.keys();
        const current = Date.now();
        const next: HistoryRecord[] = [];

        for (const key of keys) {
          const url = new URL(key.url);
          if (!url.pathname.startsWith(HISTORY_PREFIX)) continue;
          const response = await cache.match(key);
          if (!response) continue;

          try {
            const record = (await response.json()) as HistoryRecord;
            if (!record.expiresAt || record.expiresAt <= current || current - record.startedAt > HISTORY_TTL_MS) {
              await cache.delete(key);
              continue;
            }
            next.push(record);
          } catch {
            await cache.delete(key);
          }
        }

        if (!cancelled) {
          setRecords(next);
          setNow(current);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 2_500);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const groups = useMemo<HistoryGroup[]>(() => {
    const map = new Map<string, HistoryRecord[]>();
    for (const record of records) {
      const list = map.get(record.fingerprint) ?? [];
      list.push(record);
      map.set(record.fingerprint, list);
    }

    return [...map.entries()]
      .map(([fingerprint, grouped]) => {
        const sorted = [...grouped].sort((a, b) => b.startedAt - a.startedAt);
        return {
          fingerprint,
          assignment: sorted[0]?.assignment ?? {},
          records: sorted,
          latestAt: Math.max(...sorted.map((item) => item.finishedAt ?? item.startedAt)),
          expiresAt: Math.max(...sorted.map((item) => item.expiresAt)),
        };
      })
      .sort((a, b) => b.latestAt - a.latestAt);
  }, [records]);

  if (!cacheSupported) {
    return <Notice>이 브라우저에서는 작업 기록 저장 기능을 사용할 수 없습니다.</Notice>;
  }

  if (loading) {
    return <Notice>최근 작업 기록을 불러오는 중입니다.</Notice>;
  }

  if (!groups.length) {
    return (
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-lg font-black text-slate-900">아직 저장된 작업이 없습니다.</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">과제 분석, 초안 작성, 독립 검증을 시작하면 이 기기에 24시간 동안 기록됩니다.</p>
        <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-black text-white" href="/assignment/workspace">수행평가 작업 시작</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <HistoryCard group={group} key={group.fingerprint} now={now} />
      ))}
    </div>
  );
}

function HistoryCard({ group, now }: { group: HistoryGroup; now: number }) {
  const running = group.records.find((record) => record.state === "RUNNING");
  const error = !running ? group.records.find((record) => record.state === "ERROR") : null;
  const verify = group.records.find((record) => record.operation === "verify" && record.state === "DONE");
  const generate = group.records.find((record) => record.operation === "generate" && record.state === "DONE");
  const analyze = group.records.find((record) => record.operation === "analyze" && record.state === "DONE");
  const remainingMinutes = Math.max(0, Math.ceil((group.expiresAt - now) / 60_000));

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-violet-600">{group.assignment.subject || "수행평가"} · {group.assignment.assignmentType || "작업"}</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">{group.assignment.topic || "제목 없는 수행평가"}</h2>
          <p className="mt-2 text-xs font-bold text-slate-400">약 {remainingMinutes}분 뒤 자동 삭제</p>
        </div>
        <Status state={running ? "RUNNING" : error ? "ERROR" : "DONE"} label={running?.label} />
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <Stage label="분석" record={analyze ?? group.records.find((item) => item.operation === "analyze")} />
        <Stage label="초안" record={generate ?? group.records.find((item) => item.operation === "generate")} />
        <Stage label="검증" record={verify ?? group.records.find((item) => item.operation === "verify")} />
      </div>

      {error?.error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error.error}</p> : null}

      {analyze || generate || verify ? (
        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-800">저장된 결과 보기</summary>
          <div className="mt-4 space-y-5">
            {analyze ? <AnalysisResultView record={analyze} /> : null}
            {generate ? <DraftResultView record={generate} /> : null}
            {verify ? <VerificationResultView record={verify} /> : null}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function Stage({ label, record }: { label: string; record?: HistoryRecord }) {
  const text = !record ? "대기" : record.state === "RUNNING" ? "진행 중" : record.state === "DONE" ? "완료" : "오류";
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-800">{text}</p>
    </div>
  );
}

function Status({ state, label }: { state: HistoryRecord["state"]; label?: string }) {
  const classes = state === "RUNNING" ? "bg-violet-100 text-violet-700" : state === "ERROR" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700";
  const text = state === "RUNNING" ? `${label || "AI 작업"} 진행 중` : state === "ERROR" ? "오류 발생" : "저장 완료";
  return <span className={`rounded-full px-3 py-1.5 text-xs font-black ${classes}`}>{text}</span>;
}

function AnalysisResultView({ record }: { record: HistoryRecord }) {
  const data = record.responseBody?.data as { taskType?: { primary?: string }; strategy?: { important?: string[] }; warnings?: string[] } | undefined;
  if (!data) return null;
  return (
    <section>
      <h3 className="text-sm font-black text-slate-950">분석 결과</h3>
      {data.taskType?.primary ? <p className="mt-2 text-sm text-slate-600">유형: {data.taskType.primary}</p> : null}
      <SimpleList items={data.strategy?.important} />
      <SimpleList items={data.warnings} muted />
    </section>
  );
}

function DraftResultView({ record }: { record: HistoryRecord }) {
  const data = record.responseBody?.data as { title?: string; thesisOrGoal?: string; sections?: Array<{ heading?: string; body?: string }> } | undefined;
  if (!data) return null;
  return (
    <section>
      <h3 className="text-sm font-black text-slate-950">초안</h3>
      {data.title ? <p className="mt-2 font-black text-slate-800">{data.title}</p> : null}
      {data.thesisOrGoal ? <p className="mt-1 text-sm leading-6 text-slate-600">{data.thesisOrGoal}</p> : null}
      <div className="mt-3 space-y-3">
        {data.sections?.map((section, index) => (
          <div key={`${section.heading || "section"}-${index}`}>
            <p className="text-sm font-black text-slate-800">{section.heading}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{section.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function VerificationResultView({ record }: { record: HistoryRecord }) {
  const data = record.responseBody?.data as { readinessScore?: number; summary?: string } | undefined;
  if (!data) return null;
  return (
    <section>
      <h3 className="text-sm font-black text-slate-950">독립 검증</h3>
      {typeof data.readinessScore === "number" ? <p className="mt-2 text-2xl font-black text-slate-900">제출 준비도 {data.readinessScore}/100</p> : null}
      {data.summary ? <p className="mt-2 text-sm leading-6 text-slate-600">{data.summary}</p> : null}
    </section>
  );
}

function SimpleList({ items, muted = false }: { items?: string[]; muted?: boolean }) {
  if (!items?.length) return null;
  return (
    <ul className={`mt-2 space-y-1 text-sm leading-6 ${muted ? "text-slate-500" : "text-slate-600"}`}>
      {items.slice(0, 6).map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}
    </ul>
  );
}

function Notice({ children }: { children: string }) {
  return <div className="rounded-[2rem] border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600 shadow-sm">{children}</div>;
}
