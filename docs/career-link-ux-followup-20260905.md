# 수행평가 진로연계 O/X 후속 보완 — 2026-09-05

## 목적

수행평가별 진로연계 O/X 기능을 사용자가 다음 단계에서도 확인할 수 있게 하고, 계정 기본값과 수행평가별 선택값의 우선순위를 자동 테스트로 고정하며, 중복된 수행평가 설정 UI를 하나로 정리한다.

## 반영 범위

1. 주제 선택, 작성 전략/초고, 초고 결과, 완성본 화면에 현재 진로연계 상태 배지를 표시한다.
2. 다음 정책을 자동 회귀 테스트한다.
   - 수행평가 O + 계정 기본 OFF → 진로 정보 사용
   - 수행평가 X + 계정 기본 ON → 진로 정보 미사용
   - 기존 수행평가 null → 계정 기본값 사용
3. 실제 설정 라우트가 사용하는 `CompactAssignmentSetup`을 단일 설정 구현으로 유지하고 `AssessmentWizard`의 레거시 `SetupScreen`과 중복 필드/핸들러를 제거한다.
4. 기존 GitHub CI의 `npm run lint` 경로에 회귀 테스트를 연결해 별도의 Actions workflow 수정 권한 없이 지속적으로 검증한다.

## 완료 조건

- TypeScript 통과
- ESLint 오류 및 관련 미사용 경고 없음
- 진로연계 회귀 테스트 3종 통과
- Next.js production build 통과
- Vercel Preview READY
- `main` 병합 후 Production READY
