"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Card } from "@/components/ui";

import {
  MAX_TEXTBOOK_PROFILES,
  TEXTBOOK_PROFILE_COOKIE,
  TEXTBOOK_PROFILE_STORAGE_KEY,
  parseTextbookProfiles,
  sanitizeTextbookProfiles,
  serializeTextbookProfiles,
  type TextbookProfile,
} from "./textbook-profile";

function emptyForm(defaultPublisher = ""): Omit<TextbookProfile, "id"> {
  return {
    curriculum: "2022 개정 교육과정",
    schoolLevel: "고등학교",
    grade: 1,
    subject: "",
    course: "",
    publisher: defaultPublisher,
    textbookTitle: "",
    unit: "",
    pages: "",
  };
}

export function TextbookProfileSettings({ defaultPublisher = "" }: { defaultPublisher?: string }) {
  const [profiles, setProfiles] = useState<TextbookProfile[]>([]);
  const [form, setForm] = useState(() => emptyForm(defaultPublisher));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const local = parseTextbookProfiles(window.localStorage.getItem(TEXTBOOK_PROFILE_STORAGE_KEY));
    const cookie = readCookieProfiles();
    const initial = local.length ? local : cookie;
    setProfiles(initial);
    if (initial.length) persistProfiles(initial);
  }, []);

  useEffect(() => {
    if (!editingId && !form.publisher && defaultPublisher) {
      setForm((current) => ({ ...current, publisher: defaultPublisher }));
    }
  }, [defaultPublisher, editingId, form.publisher]);

  function resetForm() {
    setForm(emptyForm(defaultPublisher));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile: TextbookProfile = { id: editingId ?? crypto.randomUUID(), ...form };
    if (!editingId && profiles.length >= MAX_TEXTBOOK_PROFILES) {
      setMessage(`교과서 프로필은 최대 ${MAX_TEXTBOOK_PROFILES}개까지 저장할 수 있습니다.`);
      return;
    }
    const candidate = editingId
      ? profiles.map((profile) => profile.id === editingId ? nextProfile : profile)
      : [nextProfile, ...profiles];
    const next = sanitizeTextbookProfiles(candidate);
    setProfiles(next);
    persistProfiles(next);
    setEditingId(null);
    resetForm();
    setMessage("이 기기에 저장했습니다. 같은 교육과정·학교급·학년·과목의 수행평가에 자동 반영됩니다.");
  }

  function edit(profile: TextbookProfile) {
    const { id, ...rest } = profile;
    setEditingId(id);
    setForm(rest);
    setMessage("선택한 프로필을 수정 중입니다.");
  }

  function remove(id: string) {
    const next = profiles.filter((profile) => profile.id !== id);
    setProfiles(next);
    persistProfiles(next);
    if (editingId === id) {
      setEditingId(null);
      resetForm();
    }
    setMessage("교과서 프로필을 삭제했습니다.");
  }

  function changeSchoolLevel(schoolLevel: TextbookProfile["schoolLevel"]) {
    const maxGrade = schoolLevel === "초등학교" ? 6 : 3;
    setForm({ ...form, schoolLevel, grade: Math.min(form.grade, maxGrade) });
  }

  const maxGrade = form.schoolLevel === "초등학교" ? 6 : 3;

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-sm font-extrabold text-violet-700">교육과정·교과서 맞춤</p>
        <h2 className="mt-1 text-lg font-black text-slate-950">과목별 교과서 프로필</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          교육과정·출판사·교과서·단원·쪽수를 저장하면 수행평가 분석, 주제 추천, 자료 조사, 설계, 초안과 검증 단계에 같은 기준을 유지합니다.
          내 정보의 기본 출판사는 새 교과서 등록 시 자동 입력되며 과목별로 변경할 수 있습니다.
          출판사와 교과서 이름만으로 본문을 추측하지 않습니다. 실제 교과서 내용을 반영하려면 과제 입력 단계에 해당 페이지·발췌·사진/PDF 분석 내용을 함께 제공해 주세요.
        </p>
      </Card>

      <Card>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="교육과정">
              <select className={inputClass} onChange={(event) => setForm({ ...form, curriculum: event.target.value as TextbookProfile["curriculum"] })} value={form.curriculum}>
                <option value="2022 개정 교육과정">2022 개정 교육과정</option>
                <option value="2015 개정 교육과정">2015 개정 교육과정</option>
              </select>
            </Field>
            <Field label="학교급">
              <select className={inputClass} onChange={(event) => changeSchoolLevel(event.target.value as TextbookProfile["schoolLevel"])} value={form.schoolLevel}>
                <option value="초등학교">초등학교</option>
                <option value="중학교">중학교</option>
                <option value="고등학교">고등학교</option>
              </select>
            </Field>
            <Field label="학년">
              <select className={inputClass} onChange={(event) => setForm({ ...form, grade: Number(event.target.value) })} value={form.grade}>
                {Array.from({ length: maxGrade }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}
              </select>
            </Field>
            <Field label="과목">
              <input className={inputClass} maxLength={40} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="예: 통합사회, 화학, 문학" required value={form.subject} />
            </Field>
            <Field label="세부 과목 (선택)">
              <input className={inputClass} maxLength={80} onChange={(event) => setForm({ ...form, course: event.target.value })} placeholder="예: 사회와 문화" value={form.course} />
            </Field>
            <Field label="출판사">
              <input className={inputClass} maxLength={40} onChange={(event) => setForm({ ...form, publisher: event.target.value })} placeholder="예: 미래엔, 비상교육, 천재교육" required value={form.publisher} />
            </Field>
            <Field label="교과서명">
              <input className={inputClass} maxLength={80} onChange={(event) => setForm({ ...form, textbookTitle: event.target.value })} placeholder="예: 통합사회 1" required value={form.textbookTitle} />
            </Field>
            <Field label="단원 (선택)">
              <input className={inputClass} maxLength={100} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="예: Ⅲ. 생활 공간과 사회" value={form.unit} />
            </Field>
            <Field label="쪽수 (선택)">
              <input className={inputClass} maxLength={40} onChange={(event) => setForm({ ...form, pages: event.target.value })} placeholder="예: 64~91쪽" value={form.pages} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="min-h-12 rounded-2xl bg-violet-700 px-5 font-extrabold text-white transition active:scale-[0.98]" type="submit">{editingId ? "수정 저장" : "교과서 등록"}</button>
            {editingId ? <button className="min-h-12 rounded-2xl border border-slate-200 px-5 font-extrabold text-slate-600" onClick={() => { setEditingId(null); resetForm(); setMessage(""); }} type="button">수정 취소</button> : null}
          </div>
          {message ? <p aria-live="polite" className="text-sm font-bold text-violet-800">{message}</p> : null}
        </form>
      </Card>

      <Card>
        <h2 className="font-black text-slate-950">저장된 교과서</h2>
        <p className="mt-1 text-xs text-slate-500">{profiles.length}/{MAX_TEXTBOOK_PROFILES}개 · 현재 기기 저장</p>
        <div className="mt-4 space-y-3">
          {profiles.length ? profiles.map((profile) => (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={profile.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{profile.subject}{profile.course ? ` · ${profile.course}` : ""} · {profile.publisher} {profile.textbookTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{profile.curriculum} · {profile.schoolLevel} {profile.grade}학년</p>
                  {(profile.unit || profile.pages) ? <p className="text-sm leading-6 text-slate-600">{profile.unit || "단원 미지정"}{profile.pages ? ` · ${profile.pages}` : ""}</p> : null}
                </div>
                <div className="flex gap-2">
                  <button className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-700" onClick={() => edit(profile)} type="button">수정</button>
                  <button className="min-h-10 rounded-xl border border-red-100 bg-white px-3 text-sm font-extrabold text-red-700" onClick={() => remove(profile.id)} type="button">삭제</button>
                </div>
              </div>
            </div>
          )) : <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">아직 등록한 교과서가 없습니다.</p>}
        </div>
      </Card>
    </div>
  );
}

function persistProfiles(profiles: TextbookProfile[]) {
  const serialized = serializeTextbookProfiles(profiles);
  window.localStorage.setItem(TEXTBOOK_PROFILE_STORAGE_KEY, serialized);
  const encoded = encodeURIComponent(serialized);
  if (encoded.length <= 3_700) {
    document.cookie = `${TEXTBOOK_PROFILE_COOKIE}=${encoded}; Path=/; Max-Age=31536000; SameSite=Lax`;
    return;
  }
  const compact = [...profiles];
  while (compact.length > 1 && encodeURIComponent(serializeTextbookProfiles(compact)).length > 3_700) compact.pop();
  document.cookie = `${TEXTBOOK_PROFILE_COOKIE}=${encodeURIComponent(serializeTextbookProfiles(compact))}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function readCookieProfiles(): TextbookProfile[] {
  const prefix = `${TEXTBOOK_PROFILE_COOKIE}=`;
  const entry = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!entry) return [];
  try {
    return parseTextbookProfiles(decodeURIComponent(entry.slice(prefix.length)));
  } catch {
    return [];
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-extrabold text-slate-700">{label}</span>{children}</label>;
}

const inputClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-950 outline-none focus:border-violet-400";
