import "server-only";

export type AdminDatabaseTableStat = {
  table: string;
  label: string;
  description: string;
  count: number | null;
  mode: "delete" | "manage" | "read_only";
  manageHref?: string;
  manageLabel?: string;
};

const TABLES = [
  {
    table: "user_profiles",
    label: "사용자 프로필",
    description: "회원 프로필, 관리자 권한과 계정 상태를 확인합니다.",
    mode: "manage",
    manageHref: "/admin/users",
    manageLabel: "사용자 관리",
  },
  {
    table: "assignments",
    label: "수행평가",
    description: "사용자가 만든 수행평가 작업의 최상위 기록입니다. 전용 데이터 화면에서 연결 데이터와 함께 삭제할 수 있습니다.",
    mode: "delete",
    manageHref: "/admin/files",
    manageLabel: "수행평가 데이터 관리",
  },
  {
    table: "curriculum_context",
    label: "교육과정 근거",
    description: "수행평가에 연결된 교육과정 성취기준과 검증 상태입니다.",
    mode: "read_only",
  },
  {
    table: "rubric_items",
    label: "평가기준",
    description: "루브릭·평가기준 항목과 배점 정보입니다.",
    mode: "read_only",
  },
  {
    table: "sources",
    label: "출처",
    description: "수행평가 근거로 사용된 출처 메타데이터입니다.",
    mode: "read_only",
  },
  {
    table: "drafts",
    label: "초안",
    description: "수행평가별 초안 버전 데이터입니다.",
    mode: "read_only",
  },
  {
    table: "verification_results",
    label: "검증 결과",
    description: "초안 독립 검증 결과와 수정 제안 기록입니다.",
    mode: "read_only",
  },
  {
    table: "claims",
    label: "주장",
    description: "초안에서 추출한 주요 주장과 검증 상태입니다.",
    mode: "read_only",
  },
  {
    table: "evidence",
    label: "근거 연결",
    description: "주장과 출처를 연결한 근거 데이터입니다.",
    mode: "read_only",
  },
  {
    table: "ai_runs",
    label: "AI 작업",
    description: "AI 실행 모델, 상태, 지연시간과 사용량 기록입니다.",
    mode: "read_only",
  },
  {
    table: "router_decisions",
    label: "모델 라우팅",
    description: "AI 모델 선택과 폴백 결정 기록입니다.",
    mode: "read_only",
  },
  {
    table: "model_registry",
    label: "AI 모델 레지스트리",
    description: "사용 가능 모델과 운영 승인 상태입니다.",
    mode: "manage",
    manageHref: "/admin/ai-models",
    manageLabel: "AI 모델 관리",
  },
  {
    table: "university_evaluation_profiles",
    label: "대학 평가 프로필",
    description: "대학·전형별 공식 평가 기준 메타데이터입니다.",
    mode: "read_only",
  },
  {
    table: "admin_audit_logs",
    label: "감사 로그",
    description: "관리자 권한·상태·데이터 변경 기록입니다. 운영 추적을 위해 삭제 기능은 제공하지 않습니다.",
    mode: "manage",
    manageHref: "/admin/audit-logs",
    manageLabel: "감사 로그 보기",
  },
] as const;

function readAdminConfig() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key)?.trim();
  if (!baseUrl || !secretKey) throw new Error("ADMIN_SUPABASE_CONFIGURATION");
  return { baseUrl: baseUrl.replace(/\/$/, ""), secretKey };
}

export class AdminDatabaseRepository {
  private readonly config = readAdminConfig();

  async listTableStats(): Promise<AdminDatabaseTableStat[]> {
    const rows = await Promise.all(
      TABLES.map(async (definition) => ({
        ...definition,
        count: await this.countRows(definition.table).catch(() => null),
      })),
    );
    return rows.map((row) => ({ ...row }));
  }

  private async countRows(table: string): Promise<number> {
    const response = await fetch(`${this.config.baseUrl}/rest/v1/${encodeURIComponent(table)}?select=id&limit=1`, {
      headers: {
        Accept: "application/json",
        apikey: this.config.secretKey,
        ...(this.config.secretKey.split(".").length === 3
          ? { Authorization: `Bearer ${this.config.secretKey}` }
          : {}),
        Prefer: "count=exact",
        Range: "0-0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`ADMIN_DATABASE_COUNT_${response.status}`);
    const total = Number(response.headers.get("content-range")?.split("/").at(-1));
    if (!Number.isFinite(total)) throw new Error("ADMIN_DATABASE_COUNT_MISSING");
    return Math.max(0, total);
  }
}
