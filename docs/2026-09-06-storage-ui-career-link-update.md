# 저장공간 관리 UI 및 작업별 진로 연계 변경

- 구현 날짜: 2026-09-06
- 대상: 수행도우미 Production

## 변경 내용

- `src/components/local-data-settings.tsx`
  - 저장 한도와 휴지통을 한 카드 안의 간결한 UI로 정리했다.
  - 저장 데이터 종류를 기본 접힘 상태의 카테고리로 바꿔 모바일 세로 길이를 줄였다.
  - 여러 로컬 앱 설정을 `앱 설정 전체` 한 항목으로 묶었다. 이 항목 삭제 시에만 포함된 로컬 설정 키를 함께 삭제한다.
  - 프로젝트·AI 대화·캘린더·업로드 원본·임시 작업 상태의 개별 선택 기능은 유지했다.
- `src/features/auth/profile-form.tsx`, `src/app/account/page.tsx`, `src/app/account/actions.ts`
  - 계정 화면의 전역 `AI 수행평가 작업에 진로 정보 반영` 체크박스를 제거했다.
  - 계정 화면은 진로 정보를 저장하는 역할만 담당하고, 반영 여부는 수행평가 작업 시작 화면에서 선택한다고 안내한다.
- `src/features/assessment/career-link-policy.ts`
  - 계정 기본값으로 진로 연계를 자동 활성화하지 않는다.
  - 수행평가 작업에서 사용자가 `진로 연계 O`를 명시한 경우에만 AI 문맥에 진로 정보를 포함한다.
- `tests/career-link-policy.test.mjs`
  - 작업별 O/X 우선과 미선택 시 비활성화를 검증한다.

## 데이터 및 보안 영향

- Supabase 스키마, RLS, Storage 정책 변경 없음.
- 기존 프로필 컬럼은 이전 버전 호환을 위해 유지하지만 프로필 저장 시 전역 기본값을 `false`로 정리한다.
- 로컬 프로젝트, IndexedDB/OPFS 파일, 암호화 동기화 구조와 수동 `.assessment-backup` 백업 동작은 변경하지 않았다.

## 테스트 결과

- Node 테스트: 7개 통과
- TypeScript, ESLint, Next.js Production build: 배포 빌드에서 최종 확인
- Production 모바일 UI와 작업별 진로 선택: 배포 후 확인

## 알려진 제한사항

- 이전 작업 데이터에 진로 연계 선택값이 없으면 자동으로 진로 정보를 사용하지 않는다. 작업 입력 화면에서 O/X를 선택해야 한다.

## 배포 결과

- GitHub 최종 commit SHA: 배포 커밋에 기록
- Vercel Production 상태 및 URL: 배포 완료 후 GitHub/Vercel 기록으로 확인
