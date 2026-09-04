import type { AssignmentInput } from "./schemas";

export function CareerLinkStatusBadge({ value }: { value: AssignmentInput["careerLinked"] }) {
  const state = value === true
    ? { label: "진로연계 O", description: "이 수행평가에서 진로 정보를 참고합니다.", className: "bg-violet-100 text-violet-800" }
    : value === false
      ? { label: "진로연계 X", description: "이 수행평가에서 진로 정보를 사용하지 않습니다.", className: "bg-slate-200 text-slate-700" }
      : { label: "진로연계 기본값", description: "기존 수행평가라 계정의 기본 진로 설정을 따릅니다.", className: "bg-amber-100 text-amber-800" };

  return (
    <span
      aria-label={state.description}
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${state.className}`}
      title={state.description}
    >
      {state.label}
    </span>
  );
}
