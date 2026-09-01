export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";
export type AccountStatus = "ACTIVE" | "LIMITED" | "SUSPENDED";

export type AdminUserSummary = {
  id: string;
  email: string;
  developerId: string | null;
  nickname: string | null;
  schoolName: string | null;
  age: number | null;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  assignmentCount: number;
  todayAiRuns: number;
};

export type AdminAuditLog = {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_type: "USER" | "AI_MODEL" | "SERVICE" | "SYSTEM" | "ADMIN";
  target_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminModelRecord = {
  id: string;
  provider: string;
  model_id: string;
  enabled: boolean;
  developer_company: string;
  country_of_headquarters: string;
  approved_provider: boolean;
  approved_model: boolean;
  allowed_for_student_data: boolean;
  security_review_passed: boolean;
  privacy_policy_verified: boolean;
  production_approved: boolean;
  deprecated: boolean;
  updated_at: string;
};

export type AiRunStats = {
  total: number;
  running: number;
  failed: number;
  completed: number;
  models: Array<{ modelId: string; count: number }>;
};
