export async function readApiResponse<T extends { error?: string }>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const text = await response.text();
  let payload: T | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as T;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || `${fallbackMessage} (${response.status})`);
  }
  if (!payload) {
    throw new Error(`${fallbackMessage} 응답을 읽지 못했습니다.`);
  }
  return payload;
}
