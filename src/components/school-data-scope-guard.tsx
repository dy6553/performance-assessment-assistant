"use client";

import { useEffect } from "react";

import { assessmentStorageBaseKeys } from "@/features/assessment/assessment-flow";

const activeScopeKey = "assessment-active-data-scope-v1";

export function SchoolDataScopeGuard({ scope }: { scope: string }) {
  useEffect(() => {
    try {
      const previousScope = window.sessionStorage.getItem(activeScopeKey);
      if (previousScope !== scope) {
        clearAssessmentKeys(window.sessionStorage);
        clearAssessmentKeys(window.localStorage);
        window.sessionStorage.setItem(activeScopeKey, scope);
      }
    } catch {
      // 저장소가 차단된 환경에서는 메모리 상태만 사용한다.
    }
  }, [scope]);

  return null;
}

function clearAssessmentKeys(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (assessmentStorageBaseKeys.some((baseKey) => key === baseKey || key.startsWith(`${baseKey}::`))) {
      storage.removeItem(key);
    }
  }
}
