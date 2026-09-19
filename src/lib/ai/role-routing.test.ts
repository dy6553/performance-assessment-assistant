import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("역할별 공유 모델 라우팅", () => {
  it("시험온 Registry v3 역할 정보를 로컬 Registry에 저장한다", () => {
    const code = source("src/lib/ai/shared-model-registry.ts");
    expect(code).toContain("workloads: model.workloads");
    expect(code).toContain("sharedWorkloads: model.workloads");
    expect(code).toContain("taskAffinityForWorkloads");
    expect(code).not.toContain('!capabilities.includes("structured_output")');
  });

  it("수행도우미는 task별 승인 역할을 먼저 필터링한다", () => {
    const code = source("src/lib/ai/router.ts");
    expect(code).toContain("supportsTask(candidate, task)");
    expect(code).toContain('roles.includes("structured_json")');
    expect(code).toContain('roles.includes("reasoning")');
    expect(code).toContain('roles.includes("independent_review")');
  });
});
