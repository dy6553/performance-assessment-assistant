# wanhee 수행평가 도우미

한국 초·중·고 수행평가를 위한 교육과정·루브릭 기반 AI 코파일럿입니다.

핵심 흐름은 **과제 요구사항 분석 → 작성 전략 → 초안 → 요구조건/교육과정/논리/사실/출처 검증 → 수정**입니다.

## 기술 스택

- Next.js App Router + TypeScript
- Vercel
- Supabase (Database/Auth/Storage)
- NVIDIA Hosted NIM API
- Zod 구조화 출력 검증

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

필수 환경 변수:

```dotenv
NVIDIA_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
CRON_SECRET=
```

`SUPABASE_SECRET_KEY`, `NVIDIA_API_KEY`, `CRON_SECRET`는 서버 전용입니다. 비밀 키에는 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

## AI Router

모델 ID는 Vercel 환경변수나 코드 설정으로 고정하지 않습니다. Router는 Supabase `model_registry`에서 production 승인된 NVIDIA 모델만 읽고 다음 Hard Filter를 적용합니다.

- 승인 Provider / 승인 Model
- 중국계 모델 제외
- 학생 데이터 정책 통과
- API 입력 학습 미사용 확인
- 보안 및 개인정보 검토 통과
- 필수 capability(`korean`, `structured_output`) 충족
- `production_approved = true`
- NVIDIA 실시간 모델 카탈로그와 가용성 교차 확인

### 자동 후보 탐색

- AI 요청이 들어오면 NVIDIA `/models` 카탈로그를 최대 1시간 캐시로 다시 확인합니다.
- Vercel Cron이 하루 1회 `/api/internal/model-catalog/sync`를 호출해 사용자가 없어도 후보 목록을 갱신합니다.
- 새 모델 ID가 발견되면 Supabase `model_registry`에 `candidate_requires_review` 상태로 자동 등록합니다.
- 자동 등록 후보는 `enabled = false`, `approved_model = false`, `production_approved = false` 상태이므로 Router가 절대 실사용하지 않습니다.
- 기존 모델이 카탈로그에서 사라지면 `catalog_available = false`로 추적합니다.
- 개발사/국가, 중국계 여부, 학생 데이터 정책, 개인정보·보안 검토와 내부 성능 평가를 통과한 뒤에만 production 승인할 수 있습니다.

## MVP

1. 학교급·학년·학년도·과목·주제·교사 안내문 입력
2. 요구사항/수행평가 유형/교육과정 추론
3. 작성 전략 생성
4. 초안 생성
5. 요구조건·교육과정·논리·사실/출처·학년 수준·루브릭 검증
6. 검증 근거와 수정 제안 표시
