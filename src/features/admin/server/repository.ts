import "server-only";

import type {
  AccountStatus,
  AdminAuditLog,
  AdminModelRecord,
  AdminUserSummary,
  AiRunStats,
  UserRole,
} from "../types";

type ProfileRow = {
  user_id: string;
  nickname: string | null;
  school_name: string | null;
  age: number | null;
  role: UserRole;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

type AuthUserRow = {
  id: string;
  email?: string;
  created_at: string;
  last_sign_in_at?: string;
};

type AuthUsersResponse = { users: AuthUserRow[] };
type AssignmentRow = { id: string; user_id: string; created_at: string };
type AiRunRow = {
  assignment_id: string | null;
  model_id: string;
  status: string;
  created_at: string;
};

type UserStatusStats = {
  total: number;
  active: number;
  restricted: number;
};

function readAdminConfig() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key)?.trim();
  if (!baseUrl || !secretKey) throw new Error("ADMIN_SUPABASE_CONFIGURATION");
  return { baseUrl: baseUrl.replace(/\/$/, ""), secretKey };
}

export class AdminRepository {
  private readonly config = readAdminConfig();

  async getProfile(userId: string): Promise<ProfileRow | null> {
    const rows = await this.rest<ProfileRow[]>("user_profiles", {
      select: "user_id,nickname,school_name,age,role,account_status,created_at,updated_at,last_login_at",
      user_id: `eq.${userId}`,
      limit: "1",
    });
    return rows[0] ?? null;
  }

  async userStatusStats(): Promise<UserStatusStats> {
    const rows = await this.rest<Array<{ account_status: AccountStatus }>>("user_profiles", {
      select: "account_status",
      limit: "10000",
    });
    const active = rows.filter((row) => row.account_status === "ACTIVE").length;
    return { total: rows.length, active, restricted: rows.length - active };
  }

  async listUsers(search = ""): Promise<AdminUserSummary[]> {
    const [profiles, authUsers, assignments, aiRuns] = await Promise.all([
      this.rest<ProfileRow[]>("user_profiles", {
        select: "user_id,nickname,school_name,age,role,account_status,created_at,updated_at,last_login_at",
        order: "created_at.desc",
        limit: "1000",
      }),
      this.authUsers(),
      this.rest<AssignmentRow[]>("assignments", {
        select: "id,user_id,created_at",
        limit: "10000",
      }),
      this.rest<AiRunRow[]>("ai_runs", {
        select: "assignment_id,model_id,status,created_at",
        created_at: `gte.${startOfTodayInSeoul()}`,
        limit: "10000",
      }),
    ]);

    const authById = new Map(authUsers.map((user) => [user.id, user]));
    const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
    const assignmentCounts = new Map<string, number>();
    const runCounts = new Map<string, number>();

    for (const assignment of assignments) {
      assignmentCounts.set(assignment.user_id, (assignmentCounts.get(assignment.user_id) ?? 0) + 1);
    }
    for (const run of aiRuns) {
      if (!run.assignment_id) continue;
      const assignment = assignmentById.get(run.assignment_id);
      if (assignment) runCounts.set(assignment.user_id, (runCounts.get(assignment.user_id) ?? 0) + 1);
    }

    const term = search.trim().toLocaleLowerCase("ko-KR");
    return profiles
      .map((profile) => {
        const auth = authById.get(profile.user_id);
        return {
          id: profile.user_id,
          email: auth?.email ?? "이메일 확인 불가",
          nickname: profile.nickname,
          schoolName: profile.school_name,
          age: profile.age,
          role: profile.role,
          status: profile.account_status,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
          lastLoginAt: profile.last_login_at ?? auth?.last_sign_in_at ?? null,
          assignmentCount: assignmentCounts.get(profile.user_id) ?? 0,
          todayAiRuns: runCounts.get(profile.user_id) ?? 0,
        } satisfies AdminUserSummary;
      })
      .filter((user) =>
        !term
          ? true
          : [user.email, user.nickname, user.schoolName, user.role, user.status]
              .filter(Boolean)
              .some((value) => String(value).toLocaleLowerCase("ko-KR").includes(term)),
      );
  }

  async getUser(userId: string): Promise<AdminUserSummary | null> {
    const users = await this.listUsers();
    return users.find((user) => user.id === userId) ?? null;
  }

  async updateAccountStatus(userId: string, status: AccountStatus) {
    await this.rest("user_profiles", { user_id: `eq.${userId}` }, {
      method: "PATCH",
      body: { account_status: status, updated_at: new Date().toISOString() },
    });
  }

  async updateUserRole(userId: string, role: UserRole) {
    await this.rest("user_profiles", { user_id: `eq.${userId}` }, {
      method: "PATCH",
      body: { role, updated_at: new Date().toISOString() },
    });
  }

  async listAuditLogs(limit = 100): Promise<AdminAuditLog[]> {
    return this.rest<AdminAuditLog[]>("admin_audit_logs", {
      select: "*",
      order: "created_at.desc",
      limit: String(limit),
    });
  }

  async addAuditLog(value: Omit<AdminAuditLog, "id" | "created_at">) {
    await this.rest("admin_audit_logs", {}, { method: "POST", body: value });
  }

  async aiStats(): Promise<AiRunStats> {
    const rows = await this.rest<AiRunRow[]>("ai_runs", {
      select: "assignment_id,model_id,status,created_at",
      created_at: `gte.${startOfTodayInSeoul()}`,
      limit: "10000",
    });
    const modelCounts = new Map<string, number>();
    for (const row of rows) {
      modelCounts.set(row.model_id, (modelCounts.get(row.model_id) ?? 0) + 1);
    }
    return {
      total: rows.length,
      running: rows.filter((row) => row.status === "running" || row.status === "queued").length,
      failed: rows.filter((row) => row.status === "failed" || row.status === "error").length,
      completed: rows.filter((row) => row.status === "completed" || row.status === "success").length,
      models: Array.from(modelCounts.entries())
        .map(([modelId, count]) => ({ modelId, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async assignmentCount(): Promise<number> {
    return this.countRows("assignments");
  }

  async listModels(): Promise<AdminModelRecord[]> {
    return this.rest<AdminModelRecord[]>("model_registry", {
      select: "id,provider,model_id,enabled,developer_company,country_of_headquarters,approved_provider,approved_model,allowed_for_student_data,security_review_passed,privacy_policy_verified,production_approved,deprecated,updated_at",
      order: "production_approved.desc,enabled.desc,model_id.asc",
      limit: "1000",
    });
  }

  async updateModelFlag(modelId: string, field: "enabled" | "production_approved", value: boolean) {
    await this.rest("model_registry", { model_id: `eq.${modelId}` }, {
      method: "PATCH",
      body: { [field]: value, updated_at: new Date().toISOString() },
    });
  }

  private async authUsers(): Promise<AuthUserRow[]> {
    const response = await this.request<AuthUsersResponse>("/auth/v1/admin/users?page=1&per_page=1000");
    return response.users ?? [];
  }

  private async rest<T = unknown>(
    table: string,
    query: Record<string, string>,
    init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
  ): Promise<T> {
    const params = new URLSearchParams(query);
    return this.request<T>(`/rest/v1/${table}${params.size ? `?${params}` : ""}`, init);
  }

  private async countRows(table: string): Promise<number> {
    const response = await fetch(`${this.config.baseUrl}/rest/v1/${table}?select=id`, {
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
    if (!response.ok) throw new Error(`ADMIN_COUNT_REQUEST_${response.status}`);
    const total = response.headers.get("content-range")?.split("/").at(-1);
    const parsed = Number(total);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async request<T>(
    path: string,
    init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
  ): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        apikey: this.config.secretKey,
        ...(this.config.secretKey.split(".").length === 3
          ? { Authorization: `Bearer ${this.config.secretKey}` }
          : {}),
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(init.method === "POST" ? { Prefer: "return=minimal" } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`ADMIN_DATA_REQUEST_${response.status}${detail ? `:${detail.slice(0, 180)}` : ""}`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

function startOfTodayInSeoul(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1_000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() - 9 * 60 * 60 * 1_000).toISOString();
}
