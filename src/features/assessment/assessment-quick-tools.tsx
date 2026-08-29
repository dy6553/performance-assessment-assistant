"use client";

import { useEffect, useState } from "react";

const assignmentTypeOptions = [
  {
    value: "자동 분석",
    title: "자동 분석",
    description: "과제 설명을 보고 AI가 알맞은 수행평가 유형을 판단합니다.",
  },
  {
    value: "조사·보고서",
    title: "조사·보고서",
    description: "탐구보고서, 조사 보고서, 논술형 과제를 준비할 때 선택합니다.",
  },
  {
    value: "발표·토론",
    title: "발표·토론",
    description: "발표 자료, 발표문, 토론 준비가 필요한 수행평가에 맞춥니다.",
  },
  {
    value: "실험·탐구",
    title: "실험·탐구",
    description: "실험, 관찰, 탐구 과정과 결과 정리가 중심인 과제에 맞춥니다.",
  },
] as const;

type AssignmentType = (typeof assignmentTypeOptions)[number]["value"];

function findAssignmentTypeSelect() {
  return Array.from(document.querySelectorAll<HTMLSelectElement>("select")).find((select) =>
    assignmentTypeOptions.every((item) =>
      Array.from(select.options).some((option) => option.value === item.value),
    ),
  );
}

function findTopicRecommendationButton() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const text = button.textContent?.trim() ?? "";
    return text === "AI 주제 추천" || text === "추천 중...";
  });
}

export function AssessmentQuickTools() {
  const [activeType, setActiveType] = useState<AssignmentType>("자동 분석");

  useEffect(() => {
    const select = findAssignmentTypeSelect();
    const topicButton = findTopicRecommendationButton();

    const originalTypeField = select?.closest<HTMLElement>("label") ?? null;
    const originalTypeDisplay = originalTypeField?.style.display ?? "";
    if (originalTypeField) originalTypeField.style.display = "none";

    const originalTopicButtonDisplay = topicButton?.style.display ?? "";
    if (topicButton) topicButton.style.display = "none";

    const syncType = () => {
      if (select && assignmentTypeOptions.some((item) => item.value === select.value)) {
        setActiveType(select.value as AssignmentType);
      }
    };
    select?.addEventListener("change", syncType);

    return () => {
      select?.removeEventListener("change", syncType);
      if (originalTypeField) originalTypeField.style.display = originalTypeDisplay;
      if (topicButton) topicButton.style.display = originalTopicButtonDisplay;
    };
  }, []);

  function chooseAssignmentType(type: AssignmentType) {
    const select = findAssignmentTypeSelect();
    if (!select) return;

    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set;
    nativeValueSetter?.call(select, type);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setActiveType(type);
  }

  function launchTopicRecommendation() {
    const button = findTopicRecommendationButton();
    if (!button) return;

    button.click();
    document.getElementById("assignment-topic")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  return (
    <section className="space-y-4" aria-label="수행평가 빠른 선택">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">수행평가 유형</p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950 sm:text-2xl">
          먼저 과제 유형을 선택하세요
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {assignmentTypeOptions.map((item) => {
          const selected = activeType === item.value;
          return (
            <button
              aria-pressed={selected}
              className={`rounded-[1.5rem] border p-4 text-left transition ${
                selected
                  ? "border-violet-500 bg-violet-600 text-white shadow-md"
                  : "border-slate-200 bg-white text-slate-900 shadow-sm hover:border-violet-300 hover:bg-violet-50"
              }`}
              key={item.value}
              onClick={() => chooseAssignmentType(item.value)}
              type="button"
            >
              <span className="block text-base font-black">{item.title}</span>
              <span
                className={`mt-2 block text-xs leading-5 ${selected ? "text-white/80" : "text-slate-500"}`}
              >
                {item.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-violet-200 bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-violet-950">주제가 아직 정해지지 않았나요?</p>
          <p className="mt-1 text-xs leading-5 text-violet-700">
            아래 기본 정보에서 과목을 입력한 뒤 AI가 수행평가 유형에 맞는 주제를 추천하도록 할 수 있습니다.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl bg-violet-700 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-800"
          onClick={launchTopicRecommendation}
          type="button"
        >
          AI 주제 추천 받기
        </button>
      </div>
    </section>
  );
}
