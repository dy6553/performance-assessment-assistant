import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_URLS = 6;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 120_000;

type LiveSourceSnapshot = {
  label: string;
  url: string;
  status: "VERIFIED" | "REACHABLE_LIMITED" | "UNREACHABLE" | "NOT_PROVIDED";
  title: string;
  publisher: string;
  publishedAt: string;
  notes: string;
};

type AcademicCandidate = {
  title: string;
  publisher: string;
  year: number | null;
  doi: string;
  url: string;
  status: "CROSSREF_METADATA_FOUND";
};

export async function collectResearchEvidence({
  sourceNotes,
  topic,
  subject,
}: {
  sourceNotes: string;
  topic: string;
  subject: string;
}): Promise<{ liveSourceChecks: LiveSourceSnapshot[]; academicCandidates: AcademicCandidate[] }> {
  const urls = extractUrls(sourceNotes).slice(0, MAX_URLS);
  const [liveSourceChecks, academicCandidates] = await Promise.all([
    Promise.all(urls.map((url, index) => inspectPublicUrl(url, index + 1))),
    searchCrossref(`${subject} ${topic}`),
  ]);

  return { liveSourceChecks, academicCandidates };
}

function extractUrls(input: string) {
  const matches = input.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  return Array.from(new Set(matches.map((value) => value.replace(/[.,;:!?]+$/, ""))));
}

async function inspectPublicUrl(url: string, index: number): Promise<LiveSourceSnapshot> {
  try {
    const result = await fetchPublicText(url, 0);
    const title = extractMeta(result.text, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]);
    const publisher = extractMeta(result.text, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    ]);
    const publishedAt = extractMeta(result.text, [
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<time[^>]+datetime=["']([^"']+)["'][^>]*>/i,
    ]);
    const description = extractMeta(result.text, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    ]);

    return {
      label: title || `사용자 제공 자료 ${index}`,
      url: result.finalUrl,
      status: result.contentType.includes("text/") || result.contentType.includes("html") ? "VERIFIED" : "REACHABLE_LIMITED",
      title,
      publisher,
      publishedAt,
      notes: description
        ? `실제 URL 접속 확인 완료. 설명: ${description.slice(0, 600)}`
        : `실제 URL 접속 확인 완료. HTTP ${result.status}, ${result.contentType || "content-type 미상"}.`,
    };
  } catch (error) {
    return {
      label: `사용자 제공 자료 ${index}`,
      url,
      status: "UNREACHABLE",
      title: "",
      publisher: "",
      publishedAt: "",
      notes: error instanceof Error ? `실제 URL 확인 실패: ${error.message}` : "실제 URL 확인 실패",
    };
  }
}

async function fetchPublicText(url: string, redirects: number): Promise<{
  finalUrl: string;
  status: number;
  contentType: string;
  text: string;
}> {
  if (redirects > MAX_REDIRECTS) throw new Error("리디렉션이 너무 많습니다.");
  const parsed = await assertPublicHttpUrl(url);
  const response = await fetch(parsed, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.8,*/*;q=0.2",
      "User-Agent": "PerformanceAssessmentAssistant/1.0 (+https://github.com/dy6553/performance-assessment-assistant)",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`HTTP ${response.status} 리디렉션 위치가 없습니다.`);
    const nextUrl = new URL(location, parsed).toString();
    return fetchPublicText(nextUrl, redirects + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "";
  const text = await readLimitedText(response);
  return { finalUrl: parsed.toString(), status: response.status, contentType, text };
}

async function readLimitedText(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BODY_BYTES) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      const remaining = MAX_BODY_BYTES - total;
      const slice = value.byteLength > remaining ? value.slice(0, remaining) : value;
      chunks.push(slice);
      total += slice.byteLength;
      if (slice.byteLength < value.byteLength) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function assertPublicHttpUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL 형식이 올바르지 않습니다.");
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("HTTP/HTTPS URL만 확인할 수 있습니다.");
  if (url.username || url.password) throw new Error("사용자 정보가 포함된 URL은 확인할 수 없습니다.");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("공개 인터넷 주소만 확인할 수 있습니다.");
  }

  const directIpVersion = isIP(hostname);
  if (directIpVersion && isPrivateAddress(hostname)) throw new Error("내부 네트워크 주소는 확인할 수 없습니다.");

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("공개 인터넷으로 확인되지 않는 주소입니다.");
  }
  return url;
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7));
  if (isIP(normalized) !== 4) return false;
  const [a, b] = normalized.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function extractMeta(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1];
    if (match) return decodeHtml(match.replace(/\s+/g, " ").trim()).slice(0, 700);
  }
  return "";
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

async function searchCrossref(query: string): Promise<AcademicCandidate[]> {
  const endpoint = new URL("https://api.crossref.org/works");
  endpoint.searchParams.set("query.bibliographic", query.slice(0, 500));
  endpoint.searchParams.set("rows", "5");
  endpoint.searchParams.set("select", "DOI,title,publisher,published-print,published-online,URL,type");

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "PerformanceAssessmentAssistant/1.0 (+https://github.com/dy6553/performance-assessment-assistant)",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as {
      message?: { items?: Array<Record<string, unknown>> };
    };
    return (payload.message?.items ?? []).flatMap((item) => {
      const rawTitle = Array.isArray(item.title) ? item.title[0] : "";
      const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
      if (!title) return [];
      const doi = typeof item.DOI === "string" ? item.DOI : "";
      const publisher = typeof item.publisher === "string" ? item.publisher : "";
      const url = typeof item.URL === "string" ? item.URL : doi ? `https://doi.org/${doi}` : "";
      const year = extractCrossrefYear(item);
      return [{ title, publisher, year, doi, url, status: "CROSSREF_METADATA_FOUND" as const }];
    }).slice(0, 5);
  } catch {
    return [];
  }
}

function extractCrossrefYear(item: Record<string, unknown>) {
  for (const key of ["published-print", "published-online"]) {
    const value = item[key] as { "date-parts"?: unknown } | undefined;
    const parts = value?.["date-parts"];
    if (Array.isArray(parts) && Array.isArray(parts[0]) && typeof parts[0][0] === "number") return parts[0][0];
  }
  return null;
}
