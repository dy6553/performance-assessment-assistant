import "server-only";

export type AdminAssignmentDataRecord = {
  id: string;
  userId: string;
  ownerLabel: string;
  schoolName: string | null;
  subject: string;
  topic: string;
  assignmentType: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type AssignmentRow = {
  id: string;
  user_id: string;
  subject: string;
  topic: string;
  assignment_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  user_id: string;
  nickname: string | null;
  school_name: string | null;
};

function readAdminConfig() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key)?.trim();
  if (!baseUrl || !secretKey) throw new Error("ADMIN_SUPABASE_CONFIGURATION");
  return { baseUrl: baseUrl.replace(/\/$/, ""), secretKey };
}

export class AdminAssignmentDataRepository {
  private readonly config = readAdminConfig();

  async listAssignments(limit = 300): Promise<AdminAssignmentDataRecord[]> {
    const [assignments, profiles] = await Promise.all([
      this.rest<AssignmentRow[]>("assignments", {
        select: "id,user_id,subject,topic,assignment_type,status,created_at,updated_at",
        order: "created_at.desc",
        limit: String(limit),
      }),
      this.rest<ProfileRow[]>("user_profiles", {
        select: "user_id,nickname,school_name",
        limit: "2000",
      }),
    ]);

    const profileById = new Map(profiles.map((profile) => [profile.user_id, profile]));
    return assignments.map((row) => {
      const profile = profileById.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        ownerLabel: profile?.nickname || `사용자 ${row.user_id.slice(0, 8)}`,
        schoolName: profile?.school_name ?? null,
        subject: row.subject,
        topic: row.topic,
        assignmentType: row.assignment_type,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async deleteAssignment(id: string): Promise<AdminAssignmentDataRecord | null> {
    const rows = await this.rest<AssignmentRow[]>("assignments", {
      select: "id,user_id,subject,topic,assignment_type,status,created_at,updated_at",
      id: `eq.${id}`,
      limit: "1",
    });
    const row = rows[0];
    if (!row) return null;

    const profiles = await this.rest<ProfileRow[]>("user_profiles", {
      select: "user_id,nickname,school_name",
      user_id: `eq.${row.user_id}`,
      limit: "1",
    });
    const profile = profiles[0];

    await this.rest("assignments", { id: `eq.${id}` }, { method: "DELETE" });
    return {
      id: row.id,
      userId: row.user_id,
      ownerLabel: profile?.nickname || `사용자 ${row.user_id.slice(0, 8)}`,
      schoolName: profile?.school_name ?? null,
      subject: row.subject,
      topic: row.topic,
      assignmentType: row.assignment_type,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async rest<T = unknown>(
    table: string,
    query: Record<string, string>,
    init: { method?: "GET" | "DELETE" } = {},
  ): Promise<T> {
    const params = new URLSearchParams(query);
    const response = await fetch(`${this.config.baseUrl}/rest/v1/${table}${params.size ? `?${params}` : ""}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        apikey: this.config.secretKey,
        ...(this.config.secretKey.split(".").length === 3
          ? { Authorization: `Bearer ${this.config.secretKey}` }
          : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`ADMIN_ASSIGNMENT_DATA_${response.status}${detail ? `:${detail.slice(0, 160)}` : ""}`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
