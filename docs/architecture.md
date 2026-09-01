# 수행도우미 아키텍처

## 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- Vercel
- Supabase Model Registry
- NVIDIA NIM 기반 AI 호출
- 서비스 워커 및 브라우저 저장소를 이용한 일부 클라이언트 상태 유지

## 주요 계층

### UI

`src/features/assessment/assessment-wizard.tsx`가 수행평가 입력과 단계 이동의 중심이다.

결과 화면은 가능한 한 입력/전략/초안/검증을 분리해 한 페이지가 지나치게 길어지지 않도록 한다.

### API

`src/app/api/assignment/*`가 수행평가 관련 요청을 받는다.

핵심 엔드포인트:

- `/api/assignment/recommend-topic`
- `/api/assignment/analyze`
- `/api/assignment/generate`
- `/api/assignment/verify`

### 서비스 계층

`src/features/assessment/server/service.ts`가 AI 요청 프롬프트, 출력 계약, 정규화 로직을 담당한다.

### 모델 라우팅

`src/lib/ai/router.ts`가 Supabase Model Registry에서 승인된 모델을 읽고 문맥에 맞춰 우선순위를 계산한다.

라우팅 문맥에는 작업 단계, 과목, 학교급, 학년, 수행평가 형식, 난이도, 입력 길이 등이 포함될 수 있다.

### AI Provider

`src/lib/ai/nvidia.ts`가 NVIDIA API 요청과 구조화 응답 파싱을 담당한다.

AI 응답은 스키마에 맞아야 하며, 스키마 실패 시 사용자에게 원시 파싱 오류를 직접 노출하지 않는다.

## 데이터 흐름

1. 사용자가 수행평가 정보를 입력한다.
2. 주제 추천 또는 직접 입력을 수행한다.
3. 서버가 과제 문맥을 모델 라우터에 전달한다.
4. 승인된 모델 중 조건에 맞는 모델이 선택된다.
5. 서비스 계층이 구조화 출력 계약과 함께 AI를 호출한다.
6. 응답은 Zod 스키마로 검증된다.
7. 클라이언트는 결과를 저장하고 다음 결과 화면으로 이동한다.
8. 최근 작업은 최대 24시간 기록에서 확인한다.

## Model Registry 원칙

승인 후보에는 최소한 다음 정책을 적용한다.

- Provider 승인
- Model 승인
- 학생 데이터 사용 허용
- API 데이터 학습 금지 정책
- 보안 검토 통과
- 개인정보 정책 검증
- production 승인
- deprecated 모델 제외

실시간 NVIDIA 카탈로그에 새 모델이 보인다는 이유만으로 바로 사용하지 않는다.

## 클라이언트 상태

수행평가 흐름은 브라우저 저장소를 활용한다. 단, 브라우저 프로세스가 운영체제에 의해 종료되면 실행 중 네트워크 요청까지 영구적으로 유지되는 서버 작업 큐와 동일하게 보장할 수 없다.

장기적으로 완전한 백그라운드 실행이 필요하면 서버 작업 큐, 작업 ID, 상태 조회 API 구조로 확장한다.

## 배포

GitHub `main` 브랜치 변경은 Vercel production 배포로 이어진다.

완료 판단은 다음 순서다.

`commit -> build -> deployment READY -> 필요 시 runtime log 확인`
