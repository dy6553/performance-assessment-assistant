import "server-only";

import { notFound } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/supabase/server/auth";

import type { UserRole } from "../types";
import { AdminRepository } from "./repository";

export type AdminContext = {
  user: { id: string; email: string };
  role: Exclude<UserRole, "USER">;
  repository: AdminRepository;
};

export async function getAdminContext(): Promise<AdminContext | null> {
  const user = await getAuthenticatedUser();
  if (!user?.email) return null;

  const repository = new AdminRepository();
  const profile = await repository.getProfile(user.id);
  if (!profile || profile.account_status !== "ACTIVE") return null;

  const role = initialSuperAdmins().has(user.email.toLocaleLowerCase("en-US"))
    ? "SUPER_ADMIN"
    : profile.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") return null;

  return {
    user: { id: user.id, email: user.email },
    role,
    repository,
  };
}

export async function requireAdmin(minimum: "ADMIN" | "SUPER_ADMIN" = "ADMIN") {
  const context = await getAdminContext();
  if (!context || (minimum === "SUPER_ADMIN" && context.role !== "SUPER_ADMIN")) notFound();
  return context;
}

function initialSuperAdmins() {
  return new Set(
    (process.env.SUPER_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  );
}
