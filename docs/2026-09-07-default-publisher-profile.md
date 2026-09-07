# 내 정보 기본 출판사 연동

- 적용일: 2026-09-07
- 대상: 수행평가 도우미 + 시험온 공통 개인화

## 변경 내용

1. 수행평가 도우미 `내 정보`에 `기본 교과서 출판사` 입력란을 추가했다.
2. 기본 출판사는 별도 수행도우미 DB에 중복 저장하지 않고 시험온의 공통 개인화 값을 사용한다.
3. 수행도우미의 로그인 토큰을 시험온 공통 개인화 API가 검증한 뒤 동일 이메일 계정의 출판사 값을 읽고 수정한다.
4. `내 교과서`에서 새 교과서를 등록할 때 공통 기본 출판사를 자동으로 채운다.
5. 과목별 교과서 프로필의 출판사가 있으면 해당 값이 기본 출판사보다 우선한다.
6. 학교·진로 정보 저장과 출판사 공통 동기화 결과를 구분해, 출판사 동기화 실패 시 사용자에게 재시도를 안내한다.
7. 출판사명만으로 실제 교과서 본문을 추측하지 않는 기존 근거 정책은 유지한다.

## 구현 파일

- `src/lib/personalization/shared-server.ts`
- `src/app/account/page.tsx`
- `src/app/account/actions.ts`
- `src/features/auth/profile-form.tsx`
- `src/app/api/personalization/shared/route.ts`
- `src/app/settings/textbooks/page.tsx`
- `src/features/assessment/textbook-profile-settings.tsx`

## 저장 원칙

- 계정 공통 기본값: 시험온 `personalization_profiles.default_publisher`
- 과목별 교과서 프로필: 기존 기기 로컬 저장
- 교과서 원문/PDF/사진: 기본 출판사 프로필에 저장하지 않음
