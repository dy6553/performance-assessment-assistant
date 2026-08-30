export const ACCESS_COOKIE = "assessment_access";
export const REFRESH_COOKIE = "assessment_refresh";
export const SCHOOL_SCOPE_COOKIE = "assessment_school_scope";

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
