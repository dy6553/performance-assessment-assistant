import "server-only";

export function publicApiError(error: unknown, fallbackMessage: string) {
  console.error(error);
  const message = error instanceof Error ? error.message : "";

  if (/timeout|timed out|abort/i.test(message)) return "AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.";
  if (/rate.?limit|too many|429/i.test(message)) return "AI 요청이 몰리고 있습니다. 잠시 후 다시 시도해 주세요.";
  if (/6페이지 이하/.test(message)) return message;
  if (/password|encrypted/i.test(message)) return "암호가 없는 PDF로 다시 올려 주세요.";
  if (/NVIDIA_API_KEY|SUPABASE|production 승인|model_registry/i.test(message)) {
    return "AI 서비스 연결을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.";
  }
  return fallbackMessage;
}
